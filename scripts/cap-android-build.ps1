# Compila AAB nativo Capacitor (NO TWA)
# Uso desde la raíz: npm run cap:android:build

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Client = Join-Path $Root "client"
Set-Location $Client

if (-not (Test-Path (Join-Path $Root "keystore.properties"))) {
  Write-Host "Falta keystore.properties en la raíz del repo." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path "C:\jdk-21")) {
  $jdk = Get-ChildItem "C:\Program Files\Eclipse Adoptium\jdk-21*" -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
  if (-not $jdk) { throw "JDK 21 no encontrado. Instala Eclipse Temurin 21." }
  cmd /c mklink /J "C:\jdk-21" "$jdk" | Out-Null
}
$env:JAVA_HOME = "C:\jdk-21"
$env:ANDROID_HOME = "C:\Users\Hoppe\AppData\Local\Android\Sdk"
$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

Write-Host "=== Build web (nativo) + sync Capacitor ===" -ForegroundColor Cyan
npm run cap:sync
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "=== Compilando AAB Capacitor ===" -ForegroundColor Cyan
Set-Location (Join-Path $Client "android")
& .\gradlew.bat bundleRelease --no-daemon
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$Out = Join-Path $Client "android\app\build\outputs\bundle\release\app-release.aab"
if (Test-Path $Out) {
  Write-Host ""
  Write-Host "AAB Capacitor listo:" -ForegroundColor Green
  Write-Host $Out
  Write-Host "versionCode 3 / versionName 2.0.0 (app nativa, no TWA)" -ForegroundColor Yellow
} else {
  Write-Host "No se encontró el AAB" -ForegroundColor Red
  exit 1
}
