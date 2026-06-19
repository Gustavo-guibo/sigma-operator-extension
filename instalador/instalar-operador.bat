@echo off
setlocal

echo.
echo ======================================================
echo   Sigma Operator - Instalacao nos Operadores
echo   Team Everest - teameverest.com.br
echo ======================================================
echo.

net session >nul 2>&1
if %errorLevel% NEQ 0 (
    echo [ERRO] Execute como Administrador.
    echo Clique com botao direito e escolha Executar como administrador
    pause
    exit /b 1
)

set EXTENSION_ID=ebompnbhkfmbcjhmddjkfghjgckjplbm
set UPDATE_URL=https://raw.githubusercontent.com/Gustavo-guibo/sigma-operator-extension/main/releases/update.xml
set REG_KEY=HKLM\SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist
set REG_SETTINGS=HKLM\SOFTWARE\Policies\Google\Chrome

echo Configuracoes:
echo   Extension ID : %EXTENSION_ID%
echo   Update URL   : %UPDATE_URL%
echo.

:: Limpar entradas anteriores
reg delete "%REG_KEY%" /f >nul 2>&1
reg delete "%REG_SETTINGS%" /v "ExtensionSettings" /f >nul 2>&1
reg delete "%REG_SETTINGS%" /v "ExtensionInstallSources" /f >nul 2>&1
reg delete "%REG_SETTINGS%" /v "ExtensionInstallAllowlist" /f >nul 2>&1

:: Registrar via ExtensionInstallForcelist
reg add "%REG_KEY%" /v "1" /t REG_SZ /d "%EXTENSION_ID%;%UPDATE_URL%" /f >nul 2>&1

:: Registrar via ExtensionSettings (metodo alternativo mais robusto)
:: toolbar_pin:force_pinned garante que o icone fique fixado na barra
reg add "%REG_SETTINGS%" /v "ExtensionSettings" /t REG_SZ /d "{\"ebompnbhkfmbcjhmddjkfghjgckjplbm\":{\"installation_mode\":\"force_installed\",\"update_url\":\"https://raw.githubusercontent.com/Gustavo-guibo/sigma-operator-extension/main/releases/update.xml\",\"toolbar_pin\":\"force_pinned\"}}" /f >nul 2>&1

if %errorLevel% EQU 0 (
    echo.
    echo ======================================================
    echo  [OK] Extensao registrada com sucesso!
    echo.
    echo  Proximo passo:
    echo    1. Feche TODAS as janelas do Chrome
    echo    2. Abra o Chrome novamente
    echo    3. Va em chrome://policy e clique Atualizar politicas
    echo    4. Va em chrome://extensions e clique Atualizar
    echo    5. Aguarde 30 segundos - Chrome baixa e instala
    echo    6. O icone Sigma aparecera fixado na barra automaticamente
    echo    7. Clique no icone e ative com a chave de licenca
    echo ======================================================
) else (
    echo [ERRO] Falha ao gravar registro.
    echo Verifique se esta executando como Administrador.
)

echo.
pause
