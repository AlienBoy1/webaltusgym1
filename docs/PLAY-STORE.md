# Guía paso a paso — Qyntra Gym en Google Play (sin fallos)

Sigue los pasos **en orden**. No saltes el paso 8 (huella de Play App Signing): es la causa #1 de que la app abra con barra del navegador.

| Dato fijo | Valor |
|-----------|-------|
| Package ID | `gym.qyntra.app` |
| URL PWA | `https://qyntagymweb.vercel.app` |
| Política privacidad | `https://qyntagymweb.vercel.app/privacidad` |

---

## Paso 1 — Subir cambios web a Vercel

Los archivos de Play Store están en el repo local pero **aún no están en producción**.

1. Haz commit y push de todos los cambios (privacidad, assetlinks, vercel.json, etc.).
2. Espera el deploy en Vercel.
3. **Comprueba** en el navegador:
   - `https://qyntagymweb.vercel.app/privacidad` → debe mostrar la política de privacidad (no “Verificando sesión”).
   - `https://qyntagymweb.vercel.app/manifest.json` → JSON válido.

---

## Paso 2 — Variables de entorno (PowerShell)

Abre PowerShell en la raíz del repo:

```powershell
cd "c:\Users\Hoppe\OneDrive\Documentos\PersonalDocuments\webaltusgym1"
$env:ANDROID_HOME = "C:\Users\Hoppe\AppData\Local\Android\Sdk"
$env:PATH += ";$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin"
java -version
```

Si `java -version` falla o el build da error de Gradle, instala **JDK 17** (Temurin) y úsalo solo para Android.

---

## Paso 3 — Keystore de subida (upload key)

**Una sola vez.** Anota contraseñas en un gestor seguro; sin este archivo no podrás actualizar la app.

```powershell
mkdir android -Force
keytool -genkeypair -alias qyntra -keyalg RSA -keysize 2048 -validity 9125 `
  -keystore android\qyntra-upload.keystore `
  -dname "CN=Qyntra Gym, OU=Mobile, O=Qyntra, L=MX, ST=MX, C=MX"
```

Te pedirá contraseña del keystore y de la clave → **usa la misma** para ambas.

Copia de seguridad: guarda `android\qyntra-upload.keystore` en USB/nube cifrada.

---

## Paso 4 — Proyecto Android (Bubblewrap)

```powershell
npx --yes @bubblewrap/cli init --manifest https://qyntagymweb.vercel.app/manifest.json --directory .
```

Responde así cuando pregunte:

| Pregunta | Respuesta |
|----------|-----------|
| ¿Instalar JDK? | **No** (ya tienes Java) |
| Domain / Host | `qyntagymweb.vercel.app` (confirma) |
| Package name | `gym.qyntra.app` |
| App name | `QYNTRA GYM` |
| Launcher name | `QYNTRA` |
| Signing key | **Use existing** → `android\qyntra-upload.keystore`, alias `qyntra`, tus contraseñas |
| Enable notifications | **Yes** |

Si ya existe `android\app`, usa en su lugar:

```powershell
npx --yes @bubblewrap/cli update
```

---

## Paso 5 — Compilar el App Bundle (.aab)

```powershell
npm run android:build
```

Busca el archivo generado (habitualmente `android\app-release-bundle.aab` o dentro de `android\app\build\outputs\bundle\release\`).

Si falla por SDK: en Android Studio → SDK Manager → instala **Android SDK 35** y **Build-Tools 35**.

---

## Paso 6 — Crear app en Play Console

1. [Google Play Console](https://play.google.com/console) → **Crear app**.
2. Nombre: **QYNTRA GYM**.
3. Idioma: **Español**.
4. App / Juego: **App**.
5. Gratis/de pago: según tu modelo (normalmente **Gratis**).

En **Configuración → Detalles de la app**:

- Categoría: **Salud y bienestar**
- Correo de contacto del desarrollador (obligatorio)

---

## Paso 7 — Ficha de Play Store (antes de producción)

Completa en **Presencia en Play Store → Ficha principal**:

| Recurso | Archivo / texto |
|---------|-----------------|
| Icono 512×512 | `client/public/pwa-512x512.png` |
| Gráfico destacado 1024×500 | Crear PNG con logo Qyntra + slogan |
| Capturas teléfono (mín. 2) | Screenshots reales de login, dashboard, entrenamientos |
| Descripción corta (80 chars) | `Comunidad fitness, rutinas, progreso y chat para tu gimnasio` |
| Descripción completa | Funciones: rutinas, retos, chat, clases, progreso, admin |
| **Política de privacidad** | `https://qyntagymweb.vercel.app/privacidad` |

---

## Paso 8 — Clasificación, público y datos

1. **Política → Contenido de la app → Clasificación de contenido** → cuestionario IARC (fitness/red social, sin violencia adulta).
2. **Público objetivo** → 13 años o más (ajusta si tu gimnasio exige otra edad).
3. **Anuncios** → No contiene anuncios (si no usas AdMob).
4. **Seguridad de datos** → declara: email, nombre, fotos, mensajes, métricas corporales, identificadores de dispositivo (push). Uso: funcionalidad de la app, no venta de datos.

---

## Paso 9 — Subir AAB a prueba interna

1. **Pruebas → Prueba interna → Crear versión**.
2. Sube el `.aab`.
3. Nombre de versión: `1.0.0 (1)`.
4. Notas: `Primera versión TWA`.
5. **Revisar y publicar** la pista interna.

En el primer upload, Google activa **Play App Signing** (acepta/recomienda usar firma gestionada por Google).

---

## Paso 10 — Huella SHA-256 de Play (CRÍTICO)

La app que instalan los usuarios **no** está firmada con tu upload key, sino con la **App signing key** de Google.  
`assetlinks.json` debe incluir esa huella o la TWA mostrará barra de Chrome.

1. Play Console → **Integridad de la app → Firma de apps**.
2. Copia el **Certificado de clave de firma de la app** → huella **SHA-256**.
3. Opcional: también la huella de **upload key** (la de tu keystore local).

Actualiza assetlinks:

```powershell
.\scripts\android-assetlinks.ps1 -Fingerprints "SHA256_DE_PLAY_APP_SIGNING","SHA256_DE_UPLOAD_KEY"
```

(Si solo tienes una, pasa una sola.)

4. **Commit + deploy a Vercel**.
5. Verifica (puede tardar 5–15 min):

https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://qyntagymweb.vercel.app&relation=delegate_permission/common.handle_all_urls

Debe listar `gym.qyntra.app` con tu(s) huella(s).

---

## Paso 11 — Probar en dispositivo real

1. Play Console → Prueba interna → **Testers** → añade tu Gmail.
2. Abre el enlace de opt-in en el teléfono Android.
3. Instala desde Play Store (no sideload).
4. Checklist en el dispositivo:
   - [ ] Abre **sin barra de URL** (pantalla completa).
   - [ ] Login con email/contraseña.
   - [ ] Login con Google.
   - [ ] Navegación principal (dashboard, entrenamientos, chat).
   - [ ] Notificaciones (si las activas).

Si ves barra de Chrome → vuelve al Paso 10 (assetlinks incorrecto o no desplegado).

---

## Paso 12 — Producción

1. Revisa que la ficha, clasificación, privacidad y seguridad de datos estén en verde (sin tareas pendientes).
2. **Producción → Crear versión** → promociona el mismo AAB probado (o sube uno nuevo).
3. Envía a revisión (1–7 días hábiles).

---

## Paso 13 — Enlace Play Store en la web

Cuando esté publicada:

1. Vercel → Environment Variables:
   ```
   VITE_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=gym.qyntra.app
   ```
2. Redeploy.

---

## Actualizaciones futuras

1. Sube `appVersionCode` y `appVersionName` en `twa-manifest.json`.
2. `npx @bubblewrap/cli update`
3. `npm run android:build`
4. Sube nuevo `.aab` a Play Console.

---

## Solución rápida de errores

| Síntoma | Causa | Fix |
|---------|-------|-----|
| Barra de URL en la app | assetlinks mal | Paso 10 |
| Play rechaza privacidad | URL caída | Paso 1, verifica `/privacidad` |
| Build Gradle falla | SDK viejo | Instala SDK 35 |
| OAuth Google falla | Supabase URLs | Site URL + Redirect `https://qyntagymweb.vercel.app/**` |
| “Package already exists” | ID ocupado | Solo puedes usar `gym.qyntra.app` si es tuyo en Play |

---

## Scripts npm

```powershell
npm run android:setup   # keystore + bubblewrap (alternativa al paso 3–4)
npm run android:build   # compilar .aab
```
