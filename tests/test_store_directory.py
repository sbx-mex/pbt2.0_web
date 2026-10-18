import re
import unittest
from scripts.build_store_directory import ROOT, read_compiled

class StoreDirectoryTests(unittest.TestCase):
    def test_compiled_directory_is_reproducible_and_unique(self):
        data=read_compiled();self.assertEqual(data['source'],'Directorio_PBT.xlsx');self.assertEqual(len(data['stores']),len({r[0] for r in data['stores']}));self.assertRegex(data['sha256'],r'^[a-f0-9]{64}$')
    def test_named_reference_stores(self):
        stores=dict(read_compiled()['stores']);self.assertEqual(stores['38333'],'Izcalli Mega');self.assertEqual(stores['38368'],'Luna Park');self.assertEqual(stores['38134'],'Pilares')
