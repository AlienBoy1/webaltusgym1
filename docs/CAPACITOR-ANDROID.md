# Qyntra Gym — App nativa Android (Capacitor)

La app de Play deja de ser TWA/Bubblewrap y pasa a **Capacitor**: shell Android nativo + tu UI React en WebView (sin Chrome, sin barra de URL, sin “Se ejecuta en Chrome”).

| Concepto | Valor |
|----------|--------|
| Package ID | `gym.qyntra.app` (mismo que en Play) |
| Proyecto Android | `client/android/` |
| Versión | `2.2.9` (`versionCode` **14**) — workout HUD vía FGS `specialUse` |
| API en nativo | `https://qyntagymweb.vercel.app/api` |

---

## Comandos

```powershell
npm run cap:sync
npm run cap:open
npm run cap:android:build
```

AAB:

```text
client\android\app\build\outputs\bundle\release\app-release.aab
```

Requisitos: `keystore.properties` en la raíz + **JDK 21** (`C:\jdk-21`).

---

## Push nativo (FCM) — ya cableado

Cliente usa `@capacitor/push-notifications` en Android. Backend usa `firebase-admin` cuando `push_subscription.type === 'fcm'`. Web sigue con VAPID/Web Push.

### Lo que YA debe estar

- [x] `client/android/app/google-services.json`
- [x] Plugin en el código + canal `qyntra_default`

### Google OAuth (app nativa)

1. Supabase → **Authentication → URL configuration → Redirect URLs**, añade exactamente:
   ```
   gym.qyntra.app://auth/callback
   https://qyntagymweb.vercel.app/auth/callback
   https://qyntagymweb.vercel.app/**
   ```
2. La app abre Google en **Chrome Custom Tabs** (cuentas guardadas) y vuelve por deep link.
3. Si ves 404 tras login, falta la URL `gym.qyntra.app://auth/callback` en Supabase.

---

1. Firebase Console → ⚙️ Project settings → **Service accounts** → **Generate new private key**.
2. Guarda el JSON **fuera de git** (o como secreto).
3. En **Vercel** (Production + Preview), añade:

```
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...todo el JSON en una línea...}
```

4. Redeploy de la API en Vercel.

Local (opcional):

```
FIREBASE_SERVICE_ACCOUNT_PATH=C:\ruta\segura\firebase-adminsdk.json
```

Sin esa variable, las push FCM **no se envían** (el login y la app sí funcionan).

---

## Play Console — tu situación actual

En la captura:

| Release | Estado |
|---------|--------|
| **2.0.0** | **Draft** (no publicada a testers aún) |
| **1.0.1** | Available to selected testers (TWA vieja) |

### A) Publicar el draft 2.0.0 a Alpha (obligatorio primero)

1. Closed testing → Alpha → Releases.
2. En **2.0.0 Draft** → **Edit release**.
3. Completa notas si faltan → **Next** → **Save** → **Start rollout to Alpha** / **Send for review**.
4. Cuando Google apruebe, los testers verán 2.0.0.

> “Create new release” está gris porque ya hay un draft. Edita ese draft; no crees otro.

### B) Subir 2.2.0 (bloqueo + push fix) — Alpha

Cuando compiles `2.2.0` (`versionCode` 5):

1. Si 2.0.0 / 2.1.0 ya no es draft, pulsa **Create new release**.
2. Sube:
   `client\android\app\build\outputs\bundle\release\app-release.aab`
3. Notas: `2.2.0 — Push nativo + bloqueo de usuarios + fixes follow`.
4. Rollout to Alpha → revisión.

### C) Versión pública (Production) — dónde y cómo

**Dónde:** Play Console → menú izquierdo → **Production** (no Closed testing).

**Requisitos típicos (cuenta nueva):**

- Closed testing con release publicada
- **≥ 20 testers** opted-in
- **≥ 14 días** de prueba cerrada
- Luego **Apply for production** (si el botón estaba bloqueado)

**Pasos cuando cumplas requisitos:**

1. **Opción fácil:** en Closed testing, junto a la release buena → **Promote release** → elige **Production**.
2. **Opción manual:** Production → **Create new release** → sube el mismo AAB (o uno nuevo con versionCode mayor) → Review → Start rollout to Production.

La ficha pública usa la misma Store listing que ya llenaste; Production solo publica el binario a todos.

---

## Checklist post-FCM

1. Configura `FIREBASE_SERVICE_ACCOUNT_JSON` en Vercel → redeploy.
2. `npm run cap:android:build`
3. Termina el draft **2.0.0** o sube **2.1.0** a Alpha.
4. Testers: desinstalan app vieja → instalan desde Play.
5. Activan notificaciones en la app → deben ver diálogo **nativo** Android.
6. Prueba enviando una notificación (mensaje, like, etc.).

---

## Foreground Service (entreno en vivo) — Play Console

La notificación/burbuja de entrenamiento usa `FOREGROUND_SERVICE_SPECIAL_USE` (no `HEALTH`: ese tipo es para sensores/datos de salud).

En **Policy → App content → Foreground service permissions**:

1. Indica que **sí** usas foreground services.
2. Marca solo **Special use**.
3. Descripción (inglés, para el reviewer):

> Keeps an ongoing workout session chronometer notification (and optional overlay HUD) while the user is actively training in the gym, so elapsed time and current exercise remain visible after the user leaves the app or locks the screen. Started when the user taps Start on a workout; stopped when the user finishes or cancels the session.

4. Impacto si se interrumpe:

> Without this service the live workout timer notification is killed when the app is backgrounded, so users lose the on-screen training timer mid-workout.

5. **Video** (YouTube unlisted): abrir app → Entrenamientos → Iniciar → minimizar app → mostrar notificación persistente con chronometer → (opcional) burbuja overlay → volver y Finalizar/Cancelar (la notificación desaparece).

---

## Flujo diario

1. Cambios en `client/src` o `server`.
2. Deploy API a Vercel si tocaste backend.
3. `npm run cap:android:build` → nuevo AAB a Play.
