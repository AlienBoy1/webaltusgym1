# Deploy solo Vercel (sin Render)

La API Express corre como **Vercel Serverless Function** (`api/index.js`).
El frontend Vite se sirve desde `client/dist`. Todo en el mismo dominio → login más rápido (sin cold start de Render Free).

## 1. Proyecto en Vercel

- Importa el repo GitHub
- **Root Directory:** vacío / raíz del monorepo (NO `client/`)
- Framework Preset: Other
- Build / Output: ya definidos en `vercel.json`
- Si en el dashboard hay Override de Install/Build Command, **desactívalo** para usar `vercel.json`

## Auth URLs (obligatorio para reset de contraseña)

Sin esto, el enlace del correo te manda a la página genérica de Supabase en vez de `/reset-password`.

En Supabase → Authentication → **URL Configuration** (proyecto `bmzaoaeykfmmppwrsrxn`):

- **Site URL:** `https://qyntagymweb.vercel.app` ← **no** `localhost:3000`
- **Redirect URLs** (añade todas):
  - `https://qyntagymweb.vercel.app/**`
  - `https://qyntagymweb.vercel.app/reset-password`
  - `https://qyntagymweb-*.vercel.app/**`
  - `http://localhost:5173/**`
  - `http://localhost:5173/reset-password`

Si Site URL sigue en `localhost:3000`, el botón del correo abre una página negra vacía.

### Plantilla del correo (diseño Qyntra)

El correo de recuperación lo envía **la API** con el HTML de marca Qyntra (ya no depende de la plantilla de Supabase). La plantilla en Supabase solo importa si vuelves a usar el mailer de Auth.

### Correo de recuperación (envío desde la app)

La API genera el enlace con Supabase Admin y **envía el mail por Gmail** (nodemailer). No uses el SMTP custom de Supabase si falla (provoca 500).

1. **Supabase → Authentication → Emails → SMTP:** desactiva *Enable custom SMTP* (OFF).
2. En **Vercel → qyntagymweb → Settings → Environment Variables** (Production + Preview):

```
SUPABASE_URL=https://bmzaoaeykfmmppwrsrxn.supabase.co
SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role>
CLIENT_URL=https://qyntagymweb.vercel.app
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=tingenieriasanchez@gmail.com
SMTP_PASS=<contraseña de aplicación de 16 caracteres>
SMTP_FROM=tingenieriasanchez@gmail.com
SMTP_FROM_NAME=Qyntra Gym
```

3. Redeploy tras guardar las variables.
4. Contraseña de aplicación: https://myaccount.google.com/apppasswords (requiere 2FA).

`CLIENT_URL` **no** debe ser `localhost` en producción (si lo es, el API intenta redirigir al local y Supabase cae al Site URL genérico).

Opcional en client build:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

**No pongas** `VITE_API_URL` apuntando a Render. En producción el cliente usa `/api` (mismo origen).

## 3. Región

`vercel.json` usa `iad1` (US East) alineada con Supabase `us-east-1`.

## 4. Local

```bash
npm run install:all
npm run dev
```

Vite proxy `/api` → `localhost:3001`.

## 5. Health check

`https://TU-DOMINIO.vercel.app/api/health`

## 6. Render

Ya no es necesario. Puedes pausar/eliminar el servicio en Render.
