import hashlib
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from scripts.ci_maintenance import clean, current, persist, main, output, GitHub, OBSOLETE

EXPECTED = 'a' * 40
NEW = 'b' * 40


class FakeAPI:
    def __init__(self, entries=None, heads=None):
        self.entries = entries if entries is not None else [
            {'path': p, 'sha': v[1], 'type': 'blob', 'mode': '100644'}
            for p, v in OBSOLETE.items()]
        self.heads = iter(heads or [EXPECTED, EXPECTED])
        self.calls = []

    def __call__(self, method, path, data=None):
        self.calls.append((method, path, data))
        if path == 'git/ref/heads/main':
            return {'object': {'sha': next(self.heads)}}
        if method == 'GET' and path == 'git/commits/' + EXPECTED:
            return {'tree': {'sha': 'c' * 40}}
        if method == 'GET' and path.startswith('git/trees/'):
            return {'tree': self.entries}
        if method == 'POST' and path == 'git/trees':
            return {'sha': 'd' * 40}
        if method == 'POST' and path == 'git/commits':
            return {'sha': NEW}
        if method == 'PATCH' and path == 'git/refs/heads/main':
            return {}
        raise AssertionError((method, path, data))


class MaintenanceTests(unittest.TestCase):
    def legacy(self, root):
        for p, data in {'js/data.js': '/* Retirado en V23. Los porcentajes se calculan exclusivamente desde los motores CSV. */\n', 'icons/.gitkeep': '\n'}.items():
            path = root / p
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(data, encoding='utf-8')

    def test_dry_run_does_not_delete(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); self.legacy(root)
            self.assertEqual(len(clean(root)['obsoletos']), 2)
            self.assertTrue((root / 'js/data.js').exists())

    def test_deletes_only_two_known_files_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); self.legacy(root)
            keep = root / 'js/excel_data.js'; keep.write_text('original')
            clean(root, True)
            self.assertEqual(keep.read_text(), 'original')
            self.assertEqual(clean(root, True)['obsoletos'], [])

    def test_modified_file_stops_all_deletion(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder); self.legacy(root)
            (root / 'icons/.gitkeep').write_text('new content')
            with self.assertRaises(ValueError): clean(root, True)
            self.assertTrue((root / 'js/data.js').exists())

    def test_symlink_parent_and_symlink_file_are_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder) / 'root'; root.mkdir()
            outside = Path(folder) / 'outside'; outside.mkdir()
            (root / 'js').symlink_to(outside, target_is_directory=True)
            with self.assertRaises(ValueError): clean(root, True)
            (root / 'js').unlink(); (root / 'js').mkdir()
            (root / 'js/data.js').symlink_to(outside / 'absent')
            with self.assertRaises(ValueError): clean(root, True)

    def test_newer_upload_never_creates_commit(self):
        api = FakeAPI(heads=[NEW])
        self.assertFalse(persist(api, EXPECTED)['current'])
        self.assertTrue(all(c[0] == 'GET' for c in api.calls))

    def test_remote_cleanup_creates_only_allowlisted_deletions_without_force(self):
        api = FakeAPI()
        result = persist(api, EXPECTED)
        self.assertEqual(set(result['deleted']), set(OBSOLETE))
        tree = next(c[2] for c in api.calls if c[:2] == ('POST', 'git/trees'))
        self.assertEqual({v['path'] for v in tree['tree']}, set(OBSOLETE))
        self.assertTrue(all(v['sha'] is None for v in tree['tree']))
        self.assertEqual(api.calls[-1], ('PATCH', 'git/refs/heads/main', {'sha': NEW, 'force': False}))

    def test_changed_remote_obsolete_is_preserved(self):
        api = FakeAPI(entries=[{'path': 'js/data.js', 'sha': NEW, 'type': 'blob', 'mode': '100644'}])
        with self.assertRaises(ValueError): persist(api, EXPECTED)
        self.assertTrue(all(c[0] == 'GET' for c in api.calls))

    def test_race_does_not_move_main(self):
        api = FakeAPI(heads=[EXPECTED, NEW])
        self.assertFalse(persist(api, EXPECTED)['current'])
        self.assertFalse(any(c[0] == 'PATCH' for c in api.calls))

    def test_already_clean_does_not_write(self):
        api = FakeAPI(entries=[])
        self.assertTrue(persist(api, EXPECTED)['current'])
        self.assertTrue(all(c[0] == 'GET' for c in api.calls))

    def test_no_partial_tree_deletion(self):
        api = FakeAPI()
        original = api.__call__
        def incomplete(method, path, data=None):
            if path.startswith('git/trees/'): return {'truncated': True, 'tree': []}
            return original(method, path, data)
        with self.assertRaises(ValueError): persist(incomplete, EXPECTED)

    def test_ref_injection_is_rejected(self):
        with self.assertRaises(ValueError): current(FakeAPI(), '../../main')

    def test_pr_cannot_write_and_wrong_repository_is_rejected(self):
        with patch.dict(os.environ, {'GITHUB_REF': 'refs/heads/main', 'GITHUB_EVENT_NAME': 'pull_request'}, clear=True):
            with patch('sys.argv', ['ci_maintenance.py', 'persist']):
                self.assertEqual(main(), 1)
        with patch.dict(os.environ, {'GITHUB_REPOSITORY': 'someone/other', 'GH_TOKEN': 'not-real'}, clear=True):
            with self.assertRaises(ValueError): GitHub()

    def test_action_outputs_are_explicit(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / 'out'
            with patch.dict(os.environ, {'GITHUB_OUTPUT': str(target)}, clear=True):
                output({'current': True, 'sha': EXPECTED})
            self.assertEqual(target.read_text(), 'current=true\nsha=' + EXPECTED + '\n')

    def test_workflow_blocks_publication_until_validation_and_cleanup_succeed(self):
        workflow = (Path(__file__).resolve().parents[1] / '.github/workflows/motores-semanales.yml').read_text()
        self.assertIn('cancel-in-progress: false', workflow)
        self.assertIn('queue: max', workflow)
        self.assertIn('needs: [validar, limpiar_repositorio]', workflow)
        self.assertIn("if: steps.head.outputs.current == 'true'", workflow)
        self.assertNotIn('continue-on-error', workflow)
        self.assertNotIn('pull_request_target', workflow)
        self.assertIn("node-version: '22'", workflow)


if __name__ == '__main__':
    unittest.main()

