# Actualiza assetlinks.json con una o más huellas SHA-256 (separadas por coma)
# Uso: .\scripts\android-assetlinks.ps1 -Fingerprints "AA:BB:..." 
#      .\scripts\android-assetlinks.ps1 -Fingerprints "UPLOAD_SHA","PLAY_SIGNING_SHA"

param(
  [Parameter(Mandatory = $true)]
  [string[]] $Fingerprints
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$AssetLinksPath = Join-Path $Root "client\public\.well-known\assetlinks.json"

$normalized = @($Fingerprints | ForEach-Object { $_.Trim().ToUpper() } | Where-Object { $_ -ne "" })
if ($normalized.Count -eq 0) {
  throw "Indica al menos una huella SHA-256."
}

$fpJson = ($normalized | ForEach-Object { "`"$_`"" }) -join ",`n        "

$content = @"
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "gym.qyntra.app",
      "sha256_cert_fingerprints": [
        $fpJson
      ]
    }
  }
]
"@

New-Item -ItemType Directory -Force -Path (Split-Path $AssetLinksPath) | Out-Null
Set-Content -Path $AssetLinksPath -Value $content -Encoding UTF8

Write-Host "Actualizado: $AssetLinksPath" -ForegroundColor Green
Write-Host "Huellas:" -ForegroundColor Cyan
$normalized | ForEach-Object { Write-Host "  $_" }
Write-Host ""
Write-Host "Siguiente: commit + deploy a Vercel, luego verifica en:" -ForegroundColor Yellow
Write-Host "https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://qyntagymweb.vercel.app&relation=delegate_permission/common.handle_all_urls"
