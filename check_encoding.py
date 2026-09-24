import openpyxl
import os

file_path = os.path.join(os.path.dirname(__file__), "Controle de Estudos2.xlsm")
wb = openpyxl.load_workbook(file_path, data_only=True)
sheet = wb['Antigo']
for row in list(sheet.iter_rows(values_only=True))[:10]:
    val = row[0]
    print(repr(val), val.encode('utf-8', errors='replace') if isinstance(val, str) else type(val))
