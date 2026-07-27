# Qyntra Gym — Supabase cutover checklist
# Project: https://supabase.com/dashboard/project/bmzaoaeykfmmppwrsrxn

## 1. Service role key (required)
1. Open Dashboard → Project Settings → API
2. Copy `service_role` (secret)
3. Create `server/.env` from `server/.env.example` and paste:
   SUPABASE_SERVICE_ROLE_KEY=...

## 2. Auth settings
- Authentication → Providers → Email: enabled
- Disable public sign-ups if you want invite-only only (Admin → Authentication → Settings → "Allow new users to sign up" OFF).
  Legacy `/api/auth/register` and access-code flow still work via Admin API (service_role).

## 3. Migrate Mongo → Supabase
```bash
cd server
# DRY_RUN=1 node scripts/migrate-mongo-to-supabase.js
node scripts/migrate-mongo-to-supabase.js
```
Migrated users get `must_reset_password=true` and temporary passwords — use Forgot Password.

## 4. Keep Mongo as rollback
Do NOT delete Atlas `altusGym` for 1–2 weeks.
Rollback = restore previous server commit + MONGODB_URI.

## 5. Deploy env (Vercel only — sin Render)

Ver [DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md).

En Vercel (Production + Preview):
- SUPABASE_URL=https://bmzaoaeykfmmppwrsrxn.supabase.co
- SUPABASE_ANON_KEY=(anon)
- SUPABASE_SERVICE_ROLE_KEY=(secret)
- CLIENT_URL=https://TU-APP.vercel.app
- VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (build del client)

**No uses** `VITE_API_URL` apuntando a Render. El cliente usa `/api` same-origin.

## 6. E2E checklist
- [ ] GET /api/health → host: vercel, db: supabase
- [ ] Register first admin (or login after migrate)
- [ ] Login / logout / /auth/me (debe ser rápido vs Render free)
- [ ] Request access → admin approve → access code → complete registration
- [ ] Workouts CRUD + XP
- [ ] Social post/like/comment/follow
- [ ] Chat send + realtime receive
- [ ] Classes enroll
- [ ] Challenges join
- [ ] Admin attendance / reports
- [ ] Forgot password email
- [ ] Hard refresh PWA / clear site data after deploy
