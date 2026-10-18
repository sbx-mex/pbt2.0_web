import csv
import hashlib
import io
from pathlib import Path
import shutil
import tempfile
import unittest
from scripts.build_weekly_motor import MotorError, ROOT, build, number, parse_motor, serialize, week_info

HEADER=['Tiendas','Semana','Clas_Semana','DayPart','Distribucion Canal','Mix de Producto','Indicadores','Unidades','Unidades AA']
ROW=['38101','202601','Lun-Jue','1_Mañana','Lobby','Espresso','','100','80']
def write_csv(path, rows=None, encoding='utf-16', delimiter=','):
    stream=io.StringIO();stream.write('Reporte exportado\nFiltro: 10/16/2026\n\n')
    writer=csv.writer(stream,delimiter=delimiter);writer.writerow(HEADER);writer.writerows(rows or [ROW])
    path.write_bytes(stream.getvalue().encode(encoding))

class WeeklyMotorTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.folder=Path(self.temp.name)

    def test_utf16_preamble_and_real_week(self):
        path=self.folder/'week.csv';write_csv(path);parsed=parse_motor(path)
        self.assertEqual(parsed['file']['week'],'202601');self.assertEqual(parsed['file']['units'],100)
        self.assertEqual(parsed['rows'][0][:4],['38101','202601','Morning','Weekday'])

    def test_semicolon_and_utf8(self):
        path=self.folder/'week.csv';write_csv(path,encoding='utf-8-sig',delimiter=';')
        self.assertEqual(parse_motor(path)['file']['rows'],1)

    def test_negative_adjustments_are_preserved(self):
        self.assertEqual(number('(1,250)'),-1250);self.assertEqual(number('0'),0);self.assertEqual(number('-4.5'),-4.5)
        with self.assertRaises(MotorError):number('abc')

    def test_original_445_month_and_invalid_week(self):
        self.assertEqual(week_info('202601')['label'],'Ene 2026');self.assertEqual(week_info('202648')['label'],'Dic 2026')
        self.assertEqual(week_info('202605')['label'],'Feb 2026');self.assertEqual(week_info('202606')['label'],'Feb 2026')
        with self.assertRaises(MotorError):week_info('202154')

    def test_exact_copy_is_omitted(self):
        a=self.folder/'a.csv';write_csv(a);shutil.copyfile(a,self.folder/'copy.csv');pack=build(self.folder)
        self.assertEqual(len(pack['files']),1);self.assertEqual(len(pack['duplicates']),1)
        self.assertEqual(sum(row[4] for row in pack['rows']),100)

    def test_conflicting_week_is_rejected(self):
        write_csv(self.folder/'a.csv');row=ROW.copy();row[7]='200';write_csv(self.folder/'b.csv',[row])
        with self.assertRaisesRegex(MotorError,'Dos motores diferentes'):build(self.folder)

    def test_duplicate_row_is_rejected(self):
        path=self.folder/'a.csv';write_csv(path,[ROW,ROW])
        with self.assertRaisesRegex(MotorError,'duplicado'):parse_motor(path)

    def test_unknown_category_is_not_silently_ignored(self):
        path=self.folder/'a.csv';row=ROW.copy();row[5]='Unknown';write_csv(path,[row])
        with self.assertRaisesRegex(MotorError,'desconocido'):parse_motor(path)

    def test_missing_columns_and_empty_folder_are_rejected(self):
        with self.assertRaises(MotorError):build(self.folder)
        path=self.folder/'bad.csv';path.write_text('a,b\n1,2\n')
        with self.assertRaisesRegex(MotorError,'columnas'):parse_motor(path)

    def test_original_pbt_engine_is_byte_identical(self):
        self.assertEqual(hashlib.sha256((ROOT/'js/excel_data.js').read_bytes()).hexdigest(),'19a88dd281e180667ac7ff2561b7d8b371b746e777002942053e11eee28a6a77')

    def test_repository_index_and_all_totals_reconcile(self):
        pack=build(ROOT/'data/motores');self.assertEqual((ROOT/'data/motores/indice.json').read_text(),serialize(pack))
        self.assertEqual(sum(row[13] for row in pack['rows']),sum(meta['rows'] for meta in pack['files']))
        self.assertAlmostEqual(sum(row[4] for row in pack['rows']),sum(meta['units'] for meta in pack['files']))
        for row in pack['rows']:
            self.assertAlmostEqual(row[4],sum(row[5:10]),places=4);self.assertAlmostEqual(row[4],sum(row[10:13]),places=4)

if __name__=='__main__':unittest.main()
