# Compila y firma el AAB con Gradle (evita bugs de Bubblewrap en Windows)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$KeystoreProps = Join-Path $Root "keystore.properties"
if (-not (Test-Path $KeystoreProps)) {
  Write-Host "Falta keystore.properties" -ForegroundColor Red
  Write-Host "1. Copia keystore.properties.example -> keystore.properties"
  Write-Host "2. Pon tu contraseña del keystore (sin comillas simples ' en la contraseña)"
  exit 1
}

# JDK sin espacios (Bubblewrap/Gradle en Windows)
$env:JAVA_HOME = "C:\jdk-17"
if (-not (Test-Path "$env:JAVA_HOME\bin\java.exe")) {
  Write-Host "Creando enlace C:\jdk-17 ..." -ForegroundColor Yellow
  cmd /c mklink /J "C:\jdk-17" "C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot" | Out-Null
}
$env:ANDROID_HOME = "C:\Users\Hoppe\AppData\Local\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

Write-Host "=== Compilando AAB (Gradle bundleRelease) ===" -ForegroundColor Cyan
& .\gradlew.bat bundleRelease --no-daemon
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$Out = Join-Path $Root "app\build\outputs\bundle\release\app-release.aab"
if (Test-Path $Out) {
  Write-Host ""
  Write-Host "AAB listo para Play Store:" -ForegroundColor Green
  Write-Host $Out
} else {
  Write-Host "Build terminó pero no se encontró app-release.aab" -ForegroundColor Red
  exit 1
}
