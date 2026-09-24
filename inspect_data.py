import os
import sys

file_path = os.path.join(os.path.dirname(__file__), "Controle de Estudos2.xlsm")

try:
    import openpyxl
    wb = openpyxl.load_workbook(file_path, data_only=True)
    print("=== PLANILHAS ENCONTRADAS ===")
    print(wb.sheetnames)
    
    for sheetname in wb.sheetnames:
        sheet = wb[sheetname]
        print(f"\n--- Planilha: {sheetname} (Linhas: {sheet.max_row}, Colunas: {sheet.max_column}) ---")
        rows = list(sheet.iter_rows(values_only=True))
        if rows:
            # Print first 5 rows
            for i, row in enumerate(rows[:6]):
                print(f"Linha {i}: {row}")
except ImportError:
    print("openpyxl não instalado. Tentando pandas...")
    try:
        import pandas as pd
        excel = pd.ExcelFile(file_path)
        print("=== PLANILHAS ===", excel.sheet_names)
        for s in excel.sheet_names:
            df = pd.read_excel(file_path, sheet_name=s)
            print(f"\n--- {s} ---")
            print(df.head())
            print(df.info())
    except Exception as e:
        print("Erro:", e)
except Exception as e:
    print("Erro ao ler arquivo:", e)
