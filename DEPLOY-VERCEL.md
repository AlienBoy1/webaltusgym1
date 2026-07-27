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

En Supabase → Authentication → URL Configuration:

- **Site URL:** `https://TU-APP.vercel.app`
- **Redirect URLs** (añade):
  - `https://TU-APP.vercel.app/**`
  - `https://*-tu-usuario.vercel.app/**`
  - `http://localhost:5173/**`

Sin esto, el correo de recovery puede no enviarse bien o el link falla al abrir.

```
SUPABASE_URL=https://bmzaoaeykfmmppwrsrxn.supabase.co
SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role>
CLIENT_URL=https://TU-PROYECTO.vercel.app
```

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
