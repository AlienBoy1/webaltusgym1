# Configura Bubblewrap (JDK 17 + Android SDK) para no repetir prompts
$ErrorActionPreference = "Stop"

$BubbleDir = Join-Path $env:USERPROFILE ".bubblewrap"
$ConfigPath = Join-Path $BubbleDir "config.json"
$AndroidSdk = "C:\Users\Hoppe\AppData\Local\Android\Sdk"

function Find-JdkHome {
  # Preferir Temurin 17 (instalación completa con archivo release)
  $Temurin = Get-ChildItem "C:\Program Files\Eclipse Adoptium\jdk-17*" -Directory -ErrorAction SilentlyContinue |
    Sort-Object Name -Descending | Select-Object -First 1
  if ($Temurin -and (Test-Path (Join-Path $Temurin.FullName "release"))) {
    return $Temurin.FullName
  }

  $BubbleJdk = Join-Path $BubbleDir "jdk"
  if (-not (Test-Path $BubbleJdk)) { return $null }

  if (Test-Path (Join-Path $BubbleJdk "release")) { return $BubbleJdk }

  foreach ($dir in Get-ChildItem -Path $BubbleJdk -Directory -ErrorAction SilentlyContinue) {
    if (Test-Path (Join-Path $dir.FullName "release")) { return $dir.FullName }
  }
  return $null
}

New-Item -ItemType Directory -Force -Path $BubbleDir | Out-Null

$jdkPath = Find-JdkHome
if (-not $jdkPath) {
  Write-Host "JDK 17 no encontrado." -ForegroundColor Red
  Write-Host "Instala Temurin 17:" -ForegroundColor Yellow
  Write-Host "  winget install EclipseAdoptium.Temurin.17.JDK"
  exit 1
}

if (-not (Test-Path $AndroidSdk)) {
  Write-Host "Android SDK no encontrado en $AndroidSdk" -ForegroundColor Red
  exit 1
}

@{
  jdkPath        = $jdkPath
  androidSdkPath = $AndroidSdk
} | ConvertTo-Json | Set-Content -Path $ConfigPath -Encoding UTF8

Write-Host "Config guardado: $ConfigPath" -ForegroundColor Green
Write-Host "  jdkPath:        $jdkPath"
Write-Host "  androidSdkPath: $AndroidSdk"
Write-Host ""
Write-Host "Siguiente:" -ForegroundColor Cyan
Write-Host "  npx --yes @bubblewrap/cli init --manifest https://qyntagymweb.vercel.app/manifest.json --directory ."
