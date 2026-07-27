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

- **Site URL:** `https://qyntagymweb.vercel.app`
- **Redirect URLs** (añade todas):
  - `https://qyntagymweb.vercel.app/**`
  - `https://qyntagymweb-*.vercel.app/**`
  - `https://webaltusgym1.vercel.app/**` (si usas ese proyecto también)
  - `http://localhost:5173/**`

### Plantilla del correo (diseño Qyntra)

El texto/diseño del email **no** sale del código de la app: se edita en Supabase.

1. Dashboard → Authentication → **Email Templates** → **Reset password**
2. **Subject:** `Restablece tu contraseña — Qyntra Gym`
3. Pega el HTML de `docs/email-recovery-qyntra.html` (debe conservar `{{ .ConfirmationURL }}`)
4. Save

### Límite de correos (plan free)

Si `/api/auth/forgot-password` falla con **rate limit**, Supabase Auth (SMTP de prueba) bloqueó más envíos. Espera ~1 h o configura SMTP propio en Authentication → Emails → SMTP Settings (Resend, Brevo, etc.).

### Variables en Vercel (proyecto `qyntagymweb`)

```
SUPABASE_URL=https://bmzaoaeykfmmppwrsrxn.supabase.co
SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role>
CLIENT_URL=https://qyntagymweb.vercel.app
```

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
