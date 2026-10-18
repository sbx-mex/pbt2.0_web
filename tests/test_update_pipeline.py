import hashlib
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from scripts.build_weekly_motor import MotorError, atomic_write, build, manifest_for, serialize
from scripts.validate_update import stage_site
from test_weekly_motor import write_csv


class UpdatePipelineTests(unittest.TestCase):
    def test_manifest_identifies_the_exact_index_and_source_files(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder=Path(temporary);write_csv(folder/'semana.csv');pack=build(folder);text=serialize(pack);manifest=manifest_for(pack,text)
            self.assertEqual(manifest['index']['bytes'],len(text.encode('utf-8')))
            self.assertEqual(manifest['index']['sha256'],hashlib.sha256(text.encode('utf-8')).hexdigest())
            self.assertEqual(manifest['files'][0]['sha256'],hashlib.sha256((folder/'semana.csv').read_bytes()).hexdigest())

    def test_atomic_write_preserves_previous_file_when_replace_fails(self):
        with tempfile.TemporaryDirectory() as temporary:
            path=Path(temporary)/'indice.json';path.write_bytes(b'valid')
            with patch.object(Path,'replace',side_effect=OSError('disk unavailable')):
                with self.assertRaises(OSError):atomic_write(path,'new')
            self.assertEqual(path.read_bytes(),b'valid');self.assertEqual(list(Path(temporary).glob('*.tmp')),[])

    def test_staged_site_contains_only_runtime_files_and_generated_motors(self):
        with tempfile.TemporaryDirectory() as temporary:
            destination=Path(temporary)/'site';stage_site(destination)
            self.assertTrue((destination/'data/motores/manifest.json').is_file())
            self.assertTrue((destination/'js/excel_data.js').is_file())
            self.assertEqual(list(destination.rglob('*.csv')),[])
            self.assertFalse((destination/'scripts').exists());self.assertFalse((destination/'tests').exists())
            with self.assertRaises(ValueError):stage_site(destination)

    def test_staging_cannot_recurse_into_project_sources(self):
        from scripts.validate_update import ROOT
        with self.assertRaises(ValueError):stage_site(ROOT/'js'/'new-site')
        self.assertFalse((ROOT/'js'/'new-site').exists())


if __name__=='__main__':unittest.main()
