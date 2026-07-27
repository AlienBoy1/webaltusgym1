# 🚀 Instrucciones para Deploy

## Problema: Los cambios no aparecen en Vercel/Render

Esto sucede porque **los cambios no se han commiteado y pusheado** al repositorio remoto.

## Solución: Hacer Commit y Push

### Opción 1: Usar el script automático (Recomendado)

```powershell
# Ejecuta este comando en PowerShell desde la raíz del proyecto
.\commit-and-push.ps1
```

### Opción 2: Hacerlo manualmente

```powershell
# 1. Ver qué archivos están modificados
git status

# 2. Agregar todos los archivos
git add .

# 3. Hacer commit
git commit -m "feat: Sistema completo QYNTRA GYM - Registro con código de acceso, badges, clases, notificaciones y más"

# 4. Hacer push
git push origin main
```

### Opción 3: Commit limpio (Borra historial anterior)

Si quieres empezar con un historial limpio:

```powershell
# ⚠️ CUIDADO: Esto BORRA todo el historial de commits
git checkout --orphan new-main
git add .
git commit -m "feat: Sistema completo QYNTRA GYM - Versión inicial"
git branch -D main
git branch -m main
git push -f origin main
```

## Verificación después del Push

1. **Vercel**: 
   - Ve a tu dashboard de Vercel
   - Verifica que aparezca un nuevo "Deployment" iniciado
   - Espera a que termine el build (2-5 minutos)

2. **Render**:
   - Ve a tu dashboard de Render
   - Verifica que aparezca un nuevo "Deploy" iniciado
   - Espera a que termine el deploy (3-7 minutos)

3. **Verificar cambios**:
   - Limpia la caché del navegador (Ctrl+Shift+R o Cmd+Shift+R)
   - O abre en modo incógnito
   - Verifica que aparezcan:
     - El nuevo sistema de registro con código de acceso
     - Badges en perfiles
     - Notificaciones de solicitudes de registro
     - Clases funcionando sin errores

## Archivos nuevos que deben estar en el commit

### Backend:
- ✅ `server/src/models/AccessCode.js`
- ✅ `server/src/models/RegistrationRequest.js`
- ✅ `server/src/routes/registration.js`
- ✅ `server/src/models/Notification.js` (actualizado con `registration_request`)
- ✅ `server/src/routes/classes.js` (corregido con import de User)
- ✅ `server/src/routes/users.js` (actualizado para incluir badges)

### Frontend:
- ✅ `client/src/components/CodeAccessModal.jsx`
- ✅ `client/src/components/TermsModal.jsx`
- ✅ `client/src/pages/Register.jsx` (completamente reescrito)
- ✅ `client/src/pages/Login.jsx` (actualizado con botón de código)
- ✅ `client/src/pages/admin/Users.jsx` (actualizado con formulario completo)
- ✅ `client/src/pages/user/UserProfile.jsx` (actualizado con badges)
- ✅ `client/src/pages/user/Notifications.jsx` (actualizado con icono de registro)

## Si después del push aún no aparecen los cambios

1. **Verifica el commit en GitHub/GitLab**:
   - Ve a tu repositorio en GitHub/GitLab
   - Verifica que el último commit tenga los cambios

2. **Fuerza el redeploy**:
   - En Vercel: Ve a Settings → Deployments → "Redeploy"
   - En Render: Ve a tu servicio → "Manual Deploy" → "Deploy latest commit"

3. **Limpia la caché**:
   - Vercel: Puede tener caché del build anterior
   - Render: Puede tener caché de node_modules

4. **Verifica las variables de entorno**:
   - Asegúrate de que `VITE_API_URL` y `VITE_SOCKET_URL` apunten al backend correcto

