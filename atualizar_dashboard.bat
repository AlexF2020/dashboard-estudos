@echo off
REM Script de automação para atualização dos dados do Dashboard (estilo Gateway)
cd /d "%~dp0"
echo ======================================================== >> log_atualizacao.txt
echo [%date% %time%] Iniciando atualizacao automatica... >> log_atualizacao.txt

REM 1. Executar o processamento de dados (ETL em Python)
python etl.py >> log_atualizacao.txt 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [%date% %time%] ERRO durante a execucao do etl.py. Verifique os detalhes acima. >> log_atualizacao.txt
    exit /b 1
)

echo [%date% %time%] ETL finalizado com sucesso! >> log_atualizacao.txt

REM 2. Sincronizar automaticamente com o repositorio remoto (GitHub Pages)
git add "Controle de Estudos2.xlsm" study_data.json study_data.js etl.py app.js index.html style.css >> log_atualizacao.txt 2>&1
git diff --staged --quiet
if %ERRORLEVEL% NEQ 0 (
    echo [%date% %time%] Enviando dados atualizados para o GitHub... >> log_atualizacao.txt
    git commit -m "Auto: Dados e data de atualizacao sincronizados [%date% %time%]" >> log_atualizacao.txt 2>&1
    git push origin main >> log_atualizacao.txt 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [%date% %time%] Publicacao remota no GitHub Pages concluida com sucesso! >> log_atualizacao.txt
    ) else (
        echo [%date% %time%] AVISO: Nao foi possivel enviar para o GitHub. Verifique a conexao de internet ou credenciais do Git. >> log_atualizacao.txt
    )
) else (
    echo [%date% %time%] Base de dados ja esta atualizada e sincronizada com o GitHub. >> log_atualizacao.txt
)

echo [%date% %time%] Processo de atualizacao concluido com exito. >> log_atualizacao.txt
