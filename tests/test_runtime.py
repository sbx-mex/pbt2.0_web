import gzip
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from scripts.validate_update import ROOT, stage_site


class RuntimeTests(unittest.TestCase):
    def test_transport_is_exact_and_release_versions_all_shell_assets(self):
        with tempfile.TemporaryDirectory() as folder:
            site=Path(folder)/'site';stage_site(site)
            info=json.loads((site/'build.json').read_text())
            self.assertGreater(info['reduction_percent'],50)
            for directory in ['plan','motores']:
                path=site/'data'/directory
                manifest=json.loads((path/'manifest.json').read_text())['index']
                raw=(path/manifest['path']).read_bytes()
                self.assertEqual(gzip.decompress((path/manifest['gzip']['path']).read_bytes()),raw)
                self.assertEqual(hashlib.sha256(raw).hexdigest(),manifest['sha256'])
            html=(site/'index.html').read_text()
            self.assertNotIn('?v=27',html)
            self.assertIn('?v='+info['release'],html)
            self.assertIn("script-src 'self';",html)
            self.assertNotIn('onclick=',html)
            self.assertEqual((site/'js/weekly-core.js').read_bytes(),(ROOT/'js/weekly-core.js').read_bytes())


if __name__=='__main__':unittest.main()
