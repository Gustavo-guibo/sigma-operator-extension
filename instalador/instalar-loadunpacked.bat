@echo off
setlocal EnableDelayedExpansion

echo.
echo ======================================================
echo   Sigma Operator - Instalacao Automatica
echo   Team Everest - teameverest.com.br
echo ======================================================
echo.

:: ── Configuracoes ─────────────────────────────────────────────────────────
set VERSION=1.2.0
set REPO=Gustavo-guibo/sigma-operator-extension
set ZIP_URL=https://github.com/%REPO%/archive/refs/heads/main.zip
set DEST_DIR=%USERPROFILE%\Documents\sigma-operator-extension
set ZIP_FILE=%TEMP%\sigma-operator-extension.zip
set CHROME_EXE=
set CHAVE=XK8F-2A9B-7C3D-1E4F

:: ── Localizar Chrome ──────────────────────────────────────────────────────
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set CHROME_EXE=C:\Program Files\Google\Chrome\Application\chrome.exe
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set CHROME_EXE=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
)

if "%CHROME_EXE%"=="" (
    echo [ERRO] Chrome nao encontrado. Instale o Google Chrome e tente novamente.
    pause
    exit /b 1
)
echo [OK] Chrome encontrado: %CHROME_EXE%

:: ── Fechar Chrome se estiver aberto ───────────────────────────────────────
tasklist | findstr /i "chrome.exe" >nul 2>&1
if not errorlevel 1 (
    echo [INFO] Fechando Chrome...
    taskkill /F /IM chrome.exe /T >nul 2>&1
    timeout /t 2 /nobreak >nul
)

:: ── Baixar ZIP do repositorio ─────────────────────────────────────────────
echo.
echo [1/4] Baixando extensao v%VERSION% do GitHub...
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%ZIP_URL%' -OutFile '%ZIP_FILE%' -UseBasicParsing}" >nul 2>&1

if not exist "%ZIP_FILE%" (
    echo [ERRO] Falha ao baixar. Verifique sua conexao com a internet.
    pause
    exit /b 1
)
echo [OK] Download concluido.

:: ── Extrair ZIP ───────────────────────────────────────────────────────────
echo [2/4] Extraindo arquivos...

:: Remover instalacao anterior se existir
if exist "%DEST_DIR%" (
    echo [INFO] Removendo versao anterior...
    rmdir /S /Q "%DEST_DIR%" >nul 2>&1
)

:: Extrair para pasta temporaria
set TEMP_EXTRACT=%TEMP%\sigma-extract-temp
if exist "%TEMP_EXTRACT%" rmdir /S /Q "%TEMP_EXTRACT%" >nul 2>&1

powershell -Command "Expand-Archive -Path '%ZIP_FILE%' -DestinationPath '%TEMP_EXTRACT%' -Force" >nul 2>&1

:: Mover pasta extraida para destino final
:: O ZIP do GitHub extrai como sigma-operator-extension-main
if exist "%TEMP_EXTRACT%\sigma-operator-extension-main" (
    move "%TEMP_EXTRACT%\sigma-operator-extension-main" "%DEST_DIR%" >nul 2>&1
) else (
    echo [ERRO] Estrutura do ZIP inesperada.
    rmdir /S /Q "%TEMP_EXTRACT%" >nul 2>&1
    del /Q "%ZIP_FILE%" >nul 2>&1
    pause
    exit /b 1
)

:: Limpar temporarios
rmdir /S /Q "%TEMP_EXTRACT%" >nul 2>&1
del /Q "%ZIP_FILE%" >nul 2>&1

if not exist "%DEST_DIR%\manifest.json" (
    echo [ERRO] Arquivos da extensao nao encontrados em %DEST_DIR%
    pause
    exit /b 1
)
echo [OK] Arquivos extraidos em: %DEST_DIR%

:: ── Criar atalho na area de trabalho (opcional) ───────────────────────────
echo [3/4] Criando atalho para gerenciar extensoes...
powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%USERPROFILE%\Desktop\Sigma Operator - Extensoes.lnk'); $s.TargetPath='%CHROME_EXE%'; $s.Arguments='chrome://extensions/'; $s.Description='Gerenciar Extensao Sigma Operator'; $s.Save()" >nul 2>&1
echo [OK] Atalho criado na area de trabalho.

:: ── Instrucoes finais ─────────────────────────────────────────────────────
echo [4/4] Preparando instrucoes...
echo.
echo ======================================================
echo  [OK] Download e extracao concluidos com sucesso!
echo.
echo  PASTA DA EXTENSAO:
echo  %DEST_DIR%
echo.
echo  AGORA FACA MANUALMENTE (so na 1a vez):
echo.
echo  1. O Chrome vai abrir em chrome://extensions/
echo  2. Ative o "Modo do desenvolvedor" (canto superior direito)
echo  3. Clique em "Carregar sem compactacao"
echo  4. Selecione a pasta:
echo     %DEST_DIR%
echo  5. O icone Sigma (S) aparece na barra do Chrome
echo  6. Clique no icone e ative com a chave:
echo     %CHAVE%
echo.
echo  ATUALIZACOES FUTURAS:
echo  Basta executar este .bat novamente - ele baixa a versao
echo  mais recente e substitui automaticamente.
echo  Depois clique em "Atualizar" em chrome://extensions/
echo ======================================================
echo.

:: Abrir Chrome em chrome://extensions/
echo Abrindo Chrome em chrome://extensions/ ...
start "" "%CHROME_EXE%" "chrome://extensions/"

echo.
pause
