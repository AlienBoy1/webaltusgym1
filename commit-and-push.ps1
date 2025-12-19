# Script para hacer commit y push de todos los cambios

Write-Host "🚀 Preparando commit y push..." -ForegroundColor Cyan

# Verificar estado
Write-Host "`n📊 Archivos modificados:" -ForegroundColor Yellow
git status --short

# Agregar todos los archivos
Write-Host "`n📦 Agregando todos los archivos..." -ForegroundColor Cyan
git add .

# Hacer commit
Write-Host "`n💾 Haciendo commit..." -ForegroundColor Cyan
$commitMessage = "feat: Sistema completo ALTUS GYM - Registro con código de acceso, badges, clases, notificaciones y más"
git commit -m $commitMessage

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Commit realizado exitosamente" -ForegroundColor Green
    
    # Hacer push
    Write-Host "`n📤 Haciendo push al repositorio remoto..." -ForegroundColor Cyan
    git push origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✅ Push realizado exitosamente!" -ForegroundColor Green
        Write-Host "`n🔄 Los cambios deberían aparecer en Vercel y Render en unos minutos." -ForegroundColor Yellow
        Write-Host "   - Vercel: Verifica que el build se haya iniciado automáticamente" -ForegroundColor Yellow
        Write-Host "   - Render: Verifica que el deploy se haya iniciado automáticamente" -ForegroundColor Yellow
    } else {
        Write-Host "`n❌ Error al hacer push. Verifica tu conexión y permisos." -ForegroundColor Red
    }
} else {
    Write-Host "`n❌ Error al hacer commit. Verifica que haya cambios para commitear." -ForegroundColor Red
}

