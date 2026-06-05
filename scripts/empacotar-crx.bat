@echo off
:: empacotar-crx.bat
:: Empacota a extensão via Chrome CLI (sem dependências npm)
:: Executar na pasta raiz do repositório

setlocal EnableDelayedExpansion

echo.
echo ======================================================
echo   Sigma Operator - Empacotamento .crx (Chrome CLI)
echo ======================================================
echo.

:: Caminho da extensão (pasta atual)
set EXTENSION_DIR=%~dp0..
set KEY_FILE=%~dp0..\key.pem

:: Verificar key.pem
if not exist "%KEY_FILE%" (
    echo [ERRO] key.pem nao encontrado em: %KEY_FILE%
    echo Execute este script na pasta scripts/ do projeto.
    pause
    exit /b 1
)

:: Encontrar o Chrome instalado
set CHROME_PATH=
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe
)
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" (
    set CHROME_PATH=C:\Program Files (x86)\Google\Chrome\Application\chrome.exe
)

if "%CHROME_PATH%"=="" (
    echo [ERRO] Chrome nao encontrado nos caminhos padrao.
    echo Edite este script e defina CHROME_PATH manualmente.
    pause
    exit /b 1
)

echo Usando Chrome: %CHROME_PATH%
echo Pasta extensao: %EXTENSION_DIR%
echo Chave: %KEY_FILE%
echo.

:: Empacotar
"%CHROME_PATH%" --pack-extension="%EXTENSION_DIR%" --pack-extension-key="%KEY_FILE%"

echo.
echo ======================================================
echo Verifique a pasta pai do projeto - deve ter gerado:
echo   sigma-operator-extension.crx
echo.
echo Renomeie para:
echo   sigma-operator-extension-v1.1.0.crx
echo e mova para a pasta dist/
echo ======================================================
echo.
pause
