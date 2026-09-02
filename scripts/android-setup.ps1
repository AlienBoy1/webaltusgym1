# Genera keystore, inicializa TWA con Bubblewrap y actualiza assetlinks.json
# Requisitos: Java JDK, Android SDK (ANDROID_HOME), Node.js
# Ejecutar desde la raíz del repo: .\scripts\android-setup.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$KeystorePath = Join-Path $Root "android\qyntra-upload.keystore"
$KeystoreAlias = "qyntra"
$AssetLinksPath = Join-Path $Root "client\public\.well-known\assetlinks.json"

Write-Host "=== Qyntra Gym — Setup Android (TWA) ===" -ForegroundColor Cyan

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  throw "Java JDK no encontrado. Instala JDK 17+ y agrega java al PATH."
}

# keytool no siempre está en PATH aunque java sí — resolver JAVA_HOME\bin
if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
  $JavaCandidates = @(
    $env:JAVA_HOME,
    "C:\Program Files\Java\jdk-26.0.1",
    "C:\Program Files\Eclipse Adoptium\jdk-17*",
    "C:\Program Files\Android\Android Studio\jbr"
  ) | Where-Object { $_ }

  foreach ($candidate in $JavaCandidates) {
    $resolved = $null
    if ($candidate -like "**") {
      $resolved = Get-ChildItem -Path ($candidate -replace '\\jdk-17\*','\jdk-17*') -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | Select-Object -First 1 -ExpandProperty FullName
    } elseif (Test-Path $candidate) {
      $resolved = $candidate
    }
    if ($resolved -and (Test-Path (Join-Path $resolved "bin\keytool.exe"))) {
      $env:JAVA_HOME = $resolved
      $env:PATH = "$resolved\bin;$env:PATH"
      Write-Host "keytool encontrado en: $resolved\bin" -ForegroundColor Green
      break
    }
  }
}

if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) {
  throw "keytool no encontrado. Agrega JAVA_HOME\bin al PATH, por ejemplo:`n  `$env:JAVA_HOME = 'C:\Program Files\Java\jdk-26.0.1'`n  `$env:PATH = `"`$env:JAVA_HOME\bin;`$env:PATH`""
}

New-Item -ItemType Directory -Force -Path (Split-Path $KeystorePath) | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path $AssetLinksPath) | Out-Null

if (-not (Test-Path $KeystorePath)) {
  Write-Host "Generando keystore de firma (guárdalo en lugar seguro)..." -ForegroundColor Yellow
  Write-Host "Usa la misma contraseña para keystore y clave cuando se solicite."
  keytool -genkeypair `
    -alias $KeystoreAlias `
    -keyalg RSA `
    -keysize 2048 `
    -validity 9125 `
    -keystore $KeystorePath `
    -dname "CN=Qyntra Gym, OU=Mobile, O=Qyntra, L=MX, ST=MX, C=MX"
} else {
  Write-Host "Keystore existente: $KeystorePath" -ForegroundColor Green
}

Write-Host "Extrayendo huella SHA-256..." -ForegroundColor Cyan
$KeytoolOut = keytool -list -v -keystore $KeystorePath -alias $KeystoreAlias 2>&1 | Out-String
if ($KeytoolOut -match "SHA256:\s*([0-9A-F:]+)") {
  $Sha256 = $Matches[1].Trim()
  Write-Host "SHA-256: $Sha256" -ForegroundColor Green

  $AssetLinks = @"
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "gym.qyntra.app",
      "sha256_cert_fingerprints": [
        "$Sha256"
      ]
    }
  }
]
"@
  Set-Content -Path $AssetLinksPath -Value $AssetLinks -Encoding UTF8
  Write-Host "Actualizado: client/public/.well-known/assetlinks.json" -ForegroundColor Green
} else {
  Write-Host "No se pudo leer SHA-256. Ejecuta manualmente:" -ForegroundColor Yellow
  Write-Host "keytool -list -v -keystore android/qyntra-upload.keystore -alias qyntra"
}

if (-not (Test-Path (Join-Path $Root "android\app"))) {
  Write-Host "Inicializando proyecto TWA con Bubblewrap..." -ForegroundColor Cyan
  Write-Host "Responde las preguntas (usa los valores por defecto del twa-manifest.json cuando aplique)."
  npx --yes @bubblewrap/cli init --manifest https://qyntagymweb.vercel.app/manifest.json --directory .
} else {
  Write-Host "Proyecto Android existente. Sincronizando con twa-manifest.json..." -ForegroundColor Cyan
  npx --yes @bubblewrap/cli update
}

Write-Host ""
Write-Host "=== Próximos pasos ===" -ForegroundColor Cyan
Write-Host "1. Compila AAB: npm run android:build"
Write-Host "2. Sube el .aab a Play Console (prueba interna)"
Write-Host "3. Copia SHA-256 de PLAY APP SIGNING (Integridad de la app -> Firma de apps)"
Write-Host "4. .\scripts\android-assetlinks.ps1 -Fingerprints `"SHA256_DE_PLAY`""
Write-Host "5. Deploy a Vercel y verifica Digital Asset Links"
Write-Host ""
Write-Host "Guía completa: docs/PLAY-STORE.md" -ForegroundColor Yellow
Write-Host ""
Write-Host "NOTA: assetlinks con solo upload key NO basta para usuarios de Play." -ForegroundColor Yellow
Write-Host "      Debes añadir la huella de Play App Signing tras el primer upload." -ForegroundColor Yellow
