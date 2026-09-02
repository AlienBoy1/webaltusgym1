# Compila el Android App Bundle (.aab) para Google Play
# Ejecutar desde la raíz: .\scripts\android-build.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Test-Path (Join-Path $Root "android\app"))) {
  throw "No existe el proyecto Android. Ejecuta primero: .\scripts\android-setup.ps1"
}

Write-Host "=== Compilando AAB para Play Store ===" -ForegroundColor Cyan
npx --yes @bubblewrap/cli build --bundleType=aab

$OutDir = Join-Path $Root "android\app-release-bundle.aab"
if (Test-Path $OutDir) {
  Write-Host "AAB generado: $OutDir" -ForegroundColor Green
} else {
  $Alt = Get-ChildItem -Path (Join-Path $Root "android") -Filter "*.aab" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($Alt) {
    Write-Host "AAB generado: $($Alt.FullName)" -ForegroundColor Green
  } else {
    Write-Host "Build completado. Busca el .aab en la carpeta android/." -ForegroundColor Yellow
  }
}
