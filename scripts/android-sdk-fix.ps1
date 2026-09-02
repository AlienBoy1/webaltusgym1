# Instala Android SDK Command-line Tools (requerido por Bubblewrap)
$ErrorActionPreference = "Stop"
$sdk = "C:\Users\Hoppe\AppData\Local\Android\Sdk"
$dest = "$sdk\cmdline-tools\latest"

function Invoke-SdkManager {
  param([string[]] $Args)
  $prev = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    & sdkmanager @Args 2>&1 | ForEach-Object {
      $line = "$_"
      if ($line -match "Warning:|^\s*$") {
        Write-Host $line -ForegroundColor DarkYellow
      } else {
        Write-Host $line
      }
    }
    if ($LASTEXITCODE -ne 0 -and $null -ne $LASTEXITCODE) {
      throw "sdkmanager falló (exit $LASTEXITCODE): $($Args -join ' ')"
    }
  } finally {
    $ErrorActionPreference = $prev
  }
}

if (Test-Path "$dest\bin\sdkmanager.bat") {
  Write-Host "cmdline-tools ya instalado: $dest" -ForegroundColor Green
} else {
  Write-Host "Instalando Android cmdline-tools (puede tardar unos minutos)..." -ForegroundColor Cyan
  $zip = "$env:TEMP\cmdline-tools.zip"
  $url = "https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip"
  Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
  $staging = "$env:TEMP\cmdline-tools-staging"
  Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Archive -Path $zip -DestinationPath $staging -Force
  New-Item -ItemType Directory -Force -Path "$sdk\cmdline-tools" | Out-Null
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  Move-Item "$staging\cmdline-tools" $dest
  Remove-Item $zip -Force -ErrorAction SilentlyContinue
  Write-Host "cmdline-tools instalado." -ForegroundColor Green
}

# Bubblewrap exige carpeta SDK\bin (enlace a cmdline-tools moderno)
$binLink = "$sdk\bin"
$cmdlineBin = "$sdk\cmdline-tools\latest\bin"
if ((Test-Path $cmdlineBin) -and -not (Test-Path $binLink)) {
  cmd /c mklink /J "$binLink" "$cmdlineBin" | Out-Null
  Write-Host "Enlace SDK\bin creado." -ForegroundColor Green
}

$env:ANDROID_HOME = $sdk
if (-not (Test-Path "C:\jdk-17")) {
  cmd /c mklink /J "C:\jdk-17" "C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot" | Out-Null
}
$env:JAVA_HOME = "C:\jdk-17"
$env:PATH = "$env:JAVA_HOME\bin;$sdk\cmdline-tools\latest\bin;$sdk\platform-tools;$env:PATH"

if (-not (Test-Path "$sdk\build-tools\36.1.0")) {
  Write-Host "Instalando build-tools 36.1.0..." -ForegroundColor Cyan
  Invoke-SdkManager @("build-tools;36.1.0")
}

Write-Host "Aceptando licencias (si hace falta)..." -ForegroundColor Cyan
cmd /c "echo y | `"$sdk\cmdline-tools\latest\bin\sdkmanager.bat`" --licenses" 2>&1 | Out-Null
Invoke-SdkManager @("platform-tools", "platforms;android-36", "build-tools;36.1.0")

@{
  jdkPath        = "C:\jdk-17"
  androidSdkPath = $sdk
} | ConvertTo-Json | Set-Content "$env:USERPROFILE\.bubblewrap\config.json" -Encoding UTF8

Write-Host ""
Write-Host "SDK listo. Ejecuta: npm run android:build" -ForegroundColor Green
