from pathlib import Path
import json
import tempfile
import unittest
from scripts.apply_update import install,restore,sha,UpdateError

class InstallerTests(unittest.TestCase):
    def fixture(self,folder):
        root=Path(folder);bundle=root/'bundle';target=root/'repo'
        (bundle/'actualizacion/js').mkdir(parents=True);(target/'js').mkdir(parents=True);(target/'data/motores').mkdir(parents=True)
        (target/'index.html').write_text('old');(target/'js/excel_data.js').write_text('original');(target/'js/data.js').write_text('obsolete');(target/'personal.txt').write_text('keep')
        (bundle/'actualizacion/index.html').write_text('new');(bundle/'actualizacion/js/new.js').write_text('added')
        manifest={'schema':1,'files':[{'path':p,'previous_sha256':sha(target/p),'sha256':sha(bundle/'actualizacion'/p)} for p in ['index.html','js/new.js']],'obsolete':[{'path':'js/data.js','sha256':sha(target/'js/data.js')}]}
        (bundle/'update-manifest.json').write_text(json.dumps(manifest));return bundle,target

    def test_dry_run_apply_cleanup_and_restore_preserve_unrelated_files(self):
        with tempfile.TemporaryDirectory() as d:
            bundle,target=self.fixture(d);install(bundle,target)
            self.assertEqual((target/'index.html').read_text(),'old')
            backup=install(bundle,target,True,validator=lambda stage:None)
            self.assertEqual((target/'index.html').read_text(),'new');self.assertFalse((target/'js/data.js').exists());self.assertEqual((target/'personal.txt').read_text(),'keep')
            restore(backup);self.assertEqual((target/'index.html').read_text(),'old');self.assertTrue((target/'js/data.js').exists());self.assertFalse((target/'js/new.js').exists())

    def test_failed_validation_and_modified_target_never_get_overwritten(self):
        with tempfile.TemporaryDirectory() as d:
            bundle,target=self.fixture(d)
            def fail(stage):raise UpdateError('failed')
            with self.assertRaises(UpdateError):install(bundle,target,True,validator=fail)
            self.assertEqual((target/'index.html').read_text(),'old')
            (target/'index.html').write_text('my changes')
            with self.assertRaises(UpdateError):install(bundle,target,True,validator=lambda stage:None)
            self.assertEqual((target/'index.html').read_text(),'my changes')

    def test_rollback_refuses_to_destroy_edits_made_after_installation(self):
        with tempfile.TemporaryDirectory() as d:
            bundle,target=self.fixture(d);backup=install(bundle,target,True,validator=lambda stage:None)
            (target/'index.html').write_text('later work')
            with self.assertRaises(UpdateError):restore(backup)
            self.assertEqual((target/'index.html').read_text(),'later work')

if __name__=='__main__':unittest.main()
