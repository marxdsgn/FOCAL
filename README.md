# FOCAL — Independent Edition

FOCAL is a standalone photography game. It has its own email/password accounts, customizable player characters, profiles and social links, real shared photo battles and voting, community chat and photo feedback, creative missions, and a five-minute photo hunt. No ChatGPT account, OpenAI API, Sites hosting, or paid domain is required.

## Free hosting plan

- **Render Free:** serves the app and backend at a free `https://your-app.onrender.com` address.
- **Supabase Free:** email/password accounts, PostgreSQL records, and private photo storage.
- **GitHub Free:** hosts the source code used by Render to deploy.

These services have free-plan usage limits. Render free web services sleep when idle and can take time to wake. Supabase free projects can pause when inactive. Choose free plans and do not enable upgrades or usage billing just to run this app. A custom domain is optional and is not included.

The app is prepared for these services, but this folder alone does not create provider accounts or deploy a public site.

## Launch checklist

1. Create free accounts at https://github.com, https://supabase.com and https://render.com.
2. Create a **free Supabase project**. Save its database password securely; FOCAL does not need it in its environment.
3. In Supabase **SQL Editor**, run `supabase/migrations/001_focal.sql`. It creates the private record table, conditional-write function and private `focal-photos` storage bucket. No public database or storage policies are needed.
4. Deploy the `focal-api` Supabase Edge Function from this source. Its entrypoint is `supabase/functions/focal-api/index.ts`; keep `verify_jwt = true` as configured in `supabase/config.toml`. For a deployment tool accepting inline files, run `node scripts/package-edge.mjs /path/to/focal-edge-package.json` to create the payload from the canonical game and persistence source. The function uses Supabase's built-in backend credential internally, so you do not need to copy a service-role key to Render. Find the project's URL and public publishable key in Supabase's API settings.
5. Upload this source folder into a new GitHub repository. Include the lockfile and migration; exclude `.env`, `node_modules/`, `dist/` and real credentials.
6. In Render, create a **Blueprint**, connect that repository and use `render.yaml`. It explicitly selects the **free web-service plan**. Do not add a paid database or disk.
7. Add only `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the publishable key is accepted under this existing setting name) in Render's environment settings. The backend defaults to `https://<project>.supabase.co/functions/v1/focal-api`; `SUPABASE_API_FUNCTION_URL` can override it only with a function on the same Supabase project. Render automatically supplies its public URL; use `APP_URL` only if adding a custom domain later.
8. After deployment, copy the free `.onrender.com` address. In Supabase **Authentication → URL Configuration**, set **Site URL** to it, and add it to the allowed redirect URLs (including the root `https://your-app.onrender.com/` and the recovery route `https://your-app.onrender.com/?reset=1`).
9. Enable email/password sign-in in Supabase and keep email confirmation enabled. Configure Supabase's recommended email-delivery settings before inviting many people; its built-in email service is limited and may restrict delivery to your organization's addresses. Custom SMTP may be needed for unrestricted public signup.
10. Open the new address, create an account, confirm the email, and create your player. Invite another player and a spectator to try a real battle.

The free plans do not make provider signup, email-delivery configuration, or authentication requirements disappear. Public signup needs a working confirmation-email service. Password-reset mail uses that same service.

## Run in VS Code

Requires Node.js 22.13+; Node 24 LTS is recommended.

```sh
npm install
```

Copy `.env.example` to `.env` and enter your project URL and publishable key. Apply the SQL migration and deploy the Edge Function first. Then use two terminals:

```sh
# Terminal 1: backend
npm run dev:server
```

```sh
# Terminal 2: frontend
npm run dev
```

Open `http://localhost:5173`. The Vite proxy sends API requests to port 3000. Keep `APP_URL=http://localhost:5173` for this setup, and add that address to Supabase's allowed authentication redirects during development.

For a local production build:

```sh
npm test
npm run build
```

Set `APP_URL=http://localhost:3000` in `.env` and run `npm start`. Open `http://localhost:3000`.

## Accounts and storage

- Email/password authentication and password recovery use Supabase Auth.
- The backend checks Supabase access tokens; browser-supplied identity headers are ignored.
- Authenticated image requests use an HttpOnly session cookie. Other API calls also send the account's bearer token. Production cookies use Secure and SameSite=Lax.
- In the default Edge mode, the private Supabase backend key stays inside Supabase's function environment. Render forwards only the verified player's JWT and the public publishable key. The function re-verifies the player and replaces incoming identity headers before calling the game rules.
- Optional direct-server mode is available when the owner supplies `SUPABASE_SERVICE_ROLE_KEY` in that host's secure environment. It uses the same private table and photo bucket directly. This is not required by the free Render deployment and no backend credential enters browser bundles.
- Database row-level security denies direct browser access to game records. Only the backend can execute conditional writes.
- Standalone accounts are new accounts. Existing ChatGPT-linked accounts and server records are not automatically transferred from the previous hosted version.
- Local practice progress and the local library are browser-specific. Export your old local backup and import it on the new address if you want to transfer practice progress, photos and notes.

## Gameplay

Previously taken photographs are welcome. Upload from your camera roll/computer or start a five-minute photo hunt. In shared rooms, the server enforces the submission deadline. Spectators get 90 seconds to vote once both entries are submitted. Participants cannot vote in their own battle; duplicate votes and duplicate rewards are blocked. Shared chat refreshes every 2.5 seconds. Community rooms support general conversation, photo sharing and direct feedback replies.

Practice matches use a clearly labeled simulated panel and a separate local career. Missions, journals, earned titles, signature photographs, optional sound and rank celebrations remain available. The photo library keeps the latest eight compressed images on your device.

## Files

- `server/`: independent HTTP server, token verification, constrained Edge proxy and Supabase persistence adapter.
- `supabase/functions/focal-api/`: authenticated shared-game backend, deployed inside Supabase.
- `scripts/package-edge.mjs`: packages the Edge entrypoint and canonical shared dependencies for deployment.
- `worker/api.js`: reusable game/room/community rules (also used by the standalone server).
- `src/auth.js`, `src/AccountAccess.jsx`: email signup, sign-in, confirmation, recovery and sign-out.
- `supabase/migrations/001_focal.sql`: backend-only schema and photo bucket.
- `render.yaml`: free Render deployment configuration.
- `tests/`: game, voting, chat, account authorization and server checks.

See `PHOTO-CREDITS.md` for sample image sources.
