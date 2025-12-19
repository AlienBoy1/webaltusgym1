# Guía de Deploy - ALTUS GYM

## Variables de Entorno Necesarias

### Render (Backend)

Configurar en el panel de Render:

```
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb+srv://alien:alien@cluster0.xr01zqx.mongodb.net/altusGym?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=altus_secret_key_2024_production
CLIENT_URL=https://tu-app-vercel.vercel.app
```

### Vercel (Frontend)

Configurar en el panel de Vercel:

```
VITE_API_URL=https://altus-gym-server.onrender.com/api
```

## Comandos Git para Nuevo Repositorio

```bash
# 1. Inicializar nuevo repositorio (si no existe)
git init

# 2. Agregar todos los archivos
git add .

# 3. Crear commit inicial
git commit -m "feat: Sistema completo de ALTUS GYM con 50+ insignias, XP optimizado y sistema de asistencias"

# 4. Agregar nuevo repositorio remoto (reemplaza con tu URL)
git remote add origin https://github.com/TU_USUARIO/altus-gym.git

# 5. Cambiar a rama main (si es necesario)
git branch -M main

# 6. Push al nuevo repositorio
git push -u origin main
```

## Configuración en Render

1. Conectar repositorio de GitHub
2. Configurar:
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && npm start`
   - **Environment**: Node
3. Agregar variables de entorno (ver arriba)
4. Deploy

## Configuración en Vercel

1. Conectar repositorio de GitHub
2. Configurar:
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Agregar variable de entorno `VITE_API_URL`
4. Deploy

## Verificación Post-Deploy

1. Verificar que el backend responda en: `https://altus-gym-server.onrender.com/api/health`
2. Verificar que el frontend cargue correctamente
3. Probar login y funcionalidades principales
4. Verificar que las insignias se desbloqueen correctamente
5. Verificar que el XP se acumule en entrenamientos, retos y clases

