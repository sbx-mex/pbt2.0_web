import json
from pathlib import Path
import subprocess
import tempfile
import unittest
import zipfile
from scripts.audit_batch_zip import audit


class BatchExportTests(unittest.TestCase):
    def test_real_browser_writer_and_pdf_renderer_pass_python_audit(self):
        root = Path(__file__).resolve().parents[1]
        script = r"""
const fs=require('node:fs'),core=require('./js/batch-core.js'),renderer=require('./js/pdf-renderer.js'),lib=require('./js/vendor/pdf-lib.min.js');
(async()=>{
const date=new Date(2026,9,18,19,0),jobs=['Morning','Lunch','Afternoon'].map(daypart=>({ceco:'38937',tab:'cafe',months:['Jul 2026','Ago 2026','Sep 2026'],weekpart:'Weekday',daypart,partners:2,partnerTablet:'No'})),files=[];
for(const job of core.order(jobs)){
 const snapshot={title:'CAFE',tab:'cafe',ceco:job.ceco,store:'38937 · Parque Tepeyac Piso 1',partners:2,weekpart:job.weekpart,daypartKey:job.daypart,daypart:core.shiftLabel(job.daypart),months:'Jul - Sep',days:'Lun - Jue',channels:[['Lobby','50%'],['Pick up & Delivery','50%']],mix:[['Espresso','40%'],['COD','10%'],['CBS','30%'],['Food','15%'],['Otro','5%']],areas:[],routines:[]};
 const bytes=await renderer.create(snapshot,lib),pdf=await lib.PDFDocument.load(bytes);
 if(!pdf.getSubject().includes(core.shiftLabel(job.daypart)))throw Error('Falta el horario en el PDF.');
 files.push({name:core.pdfName(job),bytes});
}
fs.writeFileSync(process.argv[1]+'/'+core.archiveName(jobs,date),new Uint8Array(await core.pdfZip(files,date).arrayBuffer()));
})().catch(e=>{console.error(e);process.exitCode=1;});
"""
        with tempfile.TemporaryDirectory() as folder:
            subprocess.run(['node', '-e', script, folder], cwd=root, check=True, timeout=40, capture_output=True)
            result = audit(Path(folder) / 'PBT_Planes_3_38937_181026.zip', 3)
            self.assertEqual(result['pdfs'], 3)
            self.assertTrue(result['solo_pdf'])
            self.assertTrue(result['todos_al_mismo_nivel'])

    def make(self, folder, files, count=None):
        path = Path(folder) / ('PBT_Planes_' + str(count if count is not None else len(files)) + '_38937_181026.zip')
        with zipfile.ZipFile(path, 'w') as archive:
            for name, data in files:
                archive.writestr(name, data)
        return path

    def test_auxiliary_files_and_nested_files_are_rejected(self):
        for name in ['RESUMEN.csv', 'MANIFIESTO.json', 'tienda/PBT_38937_plan.pdf', '../PBT_38937_plan.pdf']:
            with self.subTest(name=name), tempfile.TemporaryDirectory() as folder:
                with self.assertRaises(ValueError):
                    audit(self.make(folder, [(name, b'%PDF-1.7\n%%EOF')]))

    def test_case_insensitive_duplicate_names_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.make(folder, [('PBT_38937_Plan.pdf', b'%PDF-1.7\n%%EOF'), ('PBT_38937_plan.pdf', b'%PDF-1.7\n%%EOF')])
            with self.assertRaises(ValueError):
                audit(path)

    def test_incomplete_pdf_and_wrong_count_are_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(ValueError):
                audit(self.make(folder, [('PBT_38937_Plan.pdf', b'%PDF-1.7 incomplete')]))
            with self.assertRaises(ValueError):
                audit(self.make(folder, [('PBT_38937_Plan.pdf', b'%PDF-1.7\n%%EOF')], count=2))

    def test_wrong_store_or_invalid_date_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            path = self.make(folder, [('PBT_38134_Plan.pdf', b'%PDF-1.7\n%%EOF')])
            with self.assertRaises(ValueError):
                audit(path)
            wrong = path.with_name('PBT_Planes_1_38937_321026.zip')
            path.rename(wrong)
            with self.assertRaises(ValueError):
                audit(wrong)


if __name__ == '__main__':
    unittest.main()

