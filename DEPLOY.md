# Arshif self-hosted deployment

This project ships a standalone Next.js image. Docker builds the application and copies the required `public` and `.next/static` assets into the runtime image. The container runs as the non-root `node` user and self-reports health via a `HEALTHCHECK` against `/manifest.json`.

## 1. Prepare the server

Requirements:

- Docker Engine 24 or newer with the `docker compose` plugin
- A DNS record pointing your domain to the server
- HTTPS termination through a reverse proxy such as Caddy or Nginx

## 2. Configure environment variables

Create a local `.env.production` on the server. Do not commit it. `docker-compose.yml` loads it through `env_file`, and the same file must be passed as `--env-file` when building so the `NEXT_PUBLIC_*` build args are filled in.

Start from the template:

```bash
cp .env.example .env.production
```

Set at least these values:

```env
NEXT_PUBLIC_SITE_URL=https://your-domain.example
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

Add these only when the related features are enabled:

```env
GEMINI_API_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
CRON_SECRET=...
SUPABASE_SERVICE_ROLE_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
TELEGRAM_WEBHOOK_SECRET=...
```

All values above are server-side secrets except the `NEXT_PUBLIC_*` values. Never put `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `VAPID_PRIVATE_KEY`, or bot tokens in client-side variables.

| Env var | Wajib? | Catatan |
| --- | --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Opsional | Ada fallback hardcoded di `lib/push.js` & `lib/push-server.js`. Kalau rotasi VAPID key lagi, WAJIB update hardcoded key di kedua file itu + set env ini samakan — kalau beda, push gagal. |

If the Supabase SQL schema enables the new-user Telegram trigger, enable Supabase Vault and store a secret named `TELEGRAM_WEBHOOK_SECRET` there. The trigger reads that Vault secret when it calls `/api/telegram-webhook-user`; otherwise the trigger remains fail-safe and skips the notification.

## 3. Build and run

```bash
git clone https://github.com/Fakeriz/arshif.git
cd arshif
cp .env.example .env.production
# edit .env.production

docker compose --env-file .env.production up -d --build
```

Compose builds the image, starts the container with the restart policy, log rotation, and healthcheck from `docker-compose.yml`, and binds the app to `127.0.0.1:3000` only.

If you prefer plain `docker` instead of Compose:

```bash
docker build -t arshif:latest .
docker run -d \
  --name arshif \
  --restart unless-stopped \
  --env-file .env.production \
  -p 127.0.0.1:3000:3000 \
  --health-cmd "node -e \"fetch('http://127.0.0.1:3000/manifest.json').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"" \
  --health-interval 30s --health-timeout 5s --health-start-period 25s --health-retries 3 \
  --log-driver json-file --log-opt max-size=10m --log-opt max-file=3 \
  arshif:latest
```

Check the container:

```bash
docker compose ps        # STATUS should show (healthy) after ~25s
curl -f http://127.0.0.1:3000/
curl -f http://127.0.0.1:3000/manifest.json
```

## 4. Update the deployment

A single command rebuilds and replaces the container. Compose recreates the container only after the new image is built, so the old container keeps serving during the build and the restart window is a few seconds. Always pass `--env-file .env.production` so the `NEXT_PUBLIC_*` build args are filled in (the Docker build context excludes `.env*` files on purpose):

```bash
git pull origin main
docker compose --env-file .env.production up -d --build
```

Dependency layers stay cached: if `package.json` / `package-lock.json` did not change, `npm ci` is skipped and only source changes are rebuilt. To pull newer dependencies, bust the cache explicitly:

```bash
docker compose --env-file .env.production build --pull
docker compose --env-file .env.production up -d
```

Roll back if needed (keep the previous image tag before updating, e.g. `docker tag arshif:latest arshif:previous`):

```bash
docker tag arshif:previous arshif:latest
docker compose up -d --no-build
```

## 5. Reverse proxy

Forward HTTPS traffic to `127.0.0.1:3000`. The container port is bound to localhost only, so ports 80 and 443 are the only public ones.

The application already sends frame, content type, referrer, and permissions security headers. Keep the reverse proxy configured for HTTPS and preserve those response headers.

## 6. Production smoke test

After DNS and HTTPS are active, verify:

```bash
curl -I https://your-domain.example/
curl -I https://your-domain.example/manifest.json
curl -I https://your-domain.example/sw.js
```

Then test in a fresh browser session:

- Onboarding Next and language selection
- Guest/demo mode
- Login and password reset
- Add transaction form
- Receipt upload when `GEMINI_API_KEY` is configured
- Push notification subscription when VAPID values are configured

The preview URL from the sandbox is not a permanent production deployment.
