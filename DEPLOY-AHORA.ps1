# Script para hacer commit y push inmediato

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  DEPLOY ALTUS GYM - Commit y Push" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que estamos en git
if (-not (Test-Path ".git")) {
    Write-Host "❌ Error: No se encontró el repositorio git" -ForegroundColor Red
    exit 1
}

# Mostrar estado actual
Write-Host "📊 Estado actual del repositorio:" -ForegroundColor Yellow
git status --short | Select-Object -First 30

Write-Host ""
Write-Host "📦 Agregando todos los archivos..." -ForegroundColor Cyan
git add -A

Write-Host ""
Write-Host "💾 Haciendo commit..." -ForegroundColor Cyan
$commitMsg = "feat: Sistema completo ALTUS GYM - Registro con código de acceso, badges, clases, notificaciones y más"
git commit -m $commitMsg

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✅ Commit exitoso!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📤 Haciendo push a origin main..." -ForegroundColor Cyan
    git push origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  ✅ PUSH EXITOSO!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "🔄 Próximos pasos:" -ForegroundColor Yellow
        Write-Host "   1. Ve a Vercel y verifica que se inició un nuevo deploy" -ForegroundColor White
        Write-Host "   2. Ve a Render y verifica que se inició un nuevo deploy" -ForegroundColor White
        Write-Host "   3. Espera 3-5 minutos para que terminen los builds" -ForegroundColor White
        Write-Host "   4. Limpia la caché del navegador (Ctrl+Shift+R)" -ForegroundColor White
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "❌ Error al hacer push" -ForegroundColor Red
        Write-Host "   Verifica tu conexión y permisos de git" -ForegroundColor Yellow
    }
} else {
    Write-Host ""
    Write-Host "❌ Error al hacer commit" -ForegroundColor Red
    Write-Host "   Puede que no haya cambios para commitear" -ForegroundColor Yellow
    Write-Host "   O puede que necesites configurar git user.name y user.email" -ForegroundColor Yellow
}

