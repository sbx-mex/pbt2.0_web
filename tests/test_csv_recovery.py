import csv
import io
from pathlib import Path
import tempfile
import unittest
from scripts.build_weekly_motor import MotorError, csv_table, decode, parse_motor
from scripts.repair_csv import repair
from test_weekly_motor import HEADER, ROW, write_csv


class CSVRecoveryTests(unittest.TestCase):
    def test_single_column_export_matches_canonical_in_every_group(self):
        with tempfile.TemporaryDirectory() as folder:
            folder = Path(folder)
            for delimiter in [',', ';', '\t']:
                canonical = folder / 'normal.csv'
                adjustment = ROW.copy(); adjustment[5] = 'Food'; adjustment[7] = '(1,250)'; adjustment[8] = '-3.5'
                write_csv(canonical, [ROW, adjustment], delimiter=delimiter)
                text = decode(canonical.read_bytes()); lines = text.splitlines(); start = next(i for i,line in enumerate(lines) if 'Tiendas' in line)
                stream = io.StringIO(); stream.write('Reporte\n\n')
                writer = csv.writer(stream, delimiter=delimiter)
                for line in lines[start:]: writer.writerow([line])
                wrapped = folder / 'wrapped.csv'; wrapped.write_text(stream.getvalue(), encoding='utf-16')
                before, after = parse_motor(canonical), parse_motor(wrapped)
                self.assertEqual(before['rows'], after['rows'])
                for key in ['week','rows','units','unitsAA','dtStores','negativeRows']:
                    self.assertEqual(before['file'][key], after['file'][key])
                self.assertTrue(csv_table(decode(wrapped.read_bytes()))[3])

    def test_mixed_or_truncated_envelope_is_rejected(self):
        with tempfile.TemporaryDirectory() as folder:
            p = Path(folder) / 'bad.csv'
            stream=io.StringIO();csv.writer(stream).writerow([','.join(HEADER)])
            p.write_text(stream.getvalue()+','.join(ROW)+'\n')
            with self.assertRaisesRegex(MotorError,'inconsistente'):parse_motor(p)
            p.write_text(stream.getvalue()+'"unclosed')
            with self.assertRaises(csv.Error):parse_motor(p)

    def test_repair_keeps_source_and_verifies_the_output(self):
        with tempfile.TemporaryDirectory() as folder:
            source, target = Path(folder)/'source.csv', Path(folder)/'recovered.csv'
            write_csv(source); original=source.read_bytes()
            result=repair(source,target)
            self.assertEqual(result['rows'],1);self.assertEqual(source.read_bytes(),original)
            self.assertEqual(parse_motor(source)['rows'],parse_motor(target)['rows'])
            with self.assertRaises(ValueError):repair(source,target)
            with self.assertRaises(ValueError):repair(source,source)
