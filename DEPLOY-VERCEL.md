# Deploy solo Vercel (sin Render)

La API Express corre como **Vercel Serverless Function** (`api/index.js`).
El frontend Vite se sirve desde `client/dist`. Todo en el mismo dominio → login más rápido (sin cold start de Render Free).

## 1. Proyecto en Vercel

- Importa el repo GitHub
- **Root Directory:** vacío / raíz del monorepo (NO `client/`)
- Framework Preset: Other
- Build / Output: ya definidos en `vercel.json`
- Si en el dashboard hay Override de Install/Build Command, **desactívalo** para usar `vercel.json`

## Auth URLs + correo de reset (obligatorio)

App en producción: `https://qyntagymweb.vercel.app`

### 1) Supabase → Authentication → URL Configuration

- **Site URL:** `https://qyntagymweb.vercel.app`  ← no dejes localhost ni la URL de supabase.co
- **Redirect URLs** (añade exactamente):
  - `https://qyntagymweb.vercel.app/**`
  - `https://qyntagymweb-*.vercel.app/**`
  - `http://localhost:5173/**`

Sin el path `/reset-password` permitido (vía `/**`), el enlace del correo cae en Site URL genérica o falla.

### 2) Plantilla del correo (diseño Qyntra)

Supabase → Authentication → Email Templates → **Reset Password**

- **Subject:** `Restablece tu contraseña — Qyntra Gym`
- **Body:** pega el HTML de `docs/supabase-email-reset.html`  
  (el botón debe usar `{{ .ConfirmationURL }}`)

El texto/diseño del email **solo** se cambia ahí; la app no controla el HTML del correo de Auth.

### 3) Variable en Vercel

```
SUPABASE_URL=https://bmzaoaeykfmmppwrsrxn.supabase.co
SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role>
CLIENT_URL=https://qyntagymweb.vercel.app
```

**Importante:** `CLIENT_URL` no debe ser `http://localhost:5173` en Vercel (si lo es, el enlace del correo apunta a localhost).

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
