@echo off
REM Script de automação para atualização dos dados do Dashboard (estilo Gateway)
cd /d "%~dp0"
echo [%date% %time%] Iniciando atualizacao automatica... >> log_atualizacao.txt
python etl.py >> log_atualizacao.txt 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [%date% %time%] Atualizacao concluida com sucesso! >> log_atualizacao.txt
) else (
    echo [%date% %time%] ERRO durante a atualizacao. Verifique o log. >> log_atualizacao.txt
)
