# Arshif self-hosted deployment

This project ships a standalone Next.js image. Docker builds the application and copies the required `public` and `.next/static` assets into the runtime image.

## 1. Prepare the server

Requirements:

- Docker Engine 24 or newer
- A DNS record pointing your domain to the server
- HTTPS termination through a reverse proxy such as Caddy or Nginx

## 2. Configure environment variables

Create a local `.env.production` on the server. Do not commit it.

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
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
NEXT_PUBLIC_TELEGRAM_BOT_TOKEN=...
NEXT_PUBLIC_TELEGRAM_CHAT_ID=...
```

Never put `SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`, `VAPID_PRIVATE_KEY`, or bot tokens in client-side variables.

## 3. Build and run

```bash
git clone https://github.com/Fakeriz/arshif.git
cd arshif
cp .env.example .env.production
# edit .env.production

docker build -t arshif:latest .
docker run -d \
  --name arshif \
  --restart unless-stopped \
  --env-file .env.production \
  -p 3000:3000 \
  arshif:latest
```

Check the container:

```bash
curl -f http://127.0.0.1:3000/
curl -f http://127.0.0.1:3000/manifest.json
```

## 4. Update the deployment

```bash
git pull origin main
docker build -t arshif:latest .
docker stop arshif || true
docker rm arshif || true
docker run -d \
  --name arshif \
  --restart unless-stopped \
  --env-file .env.production \
  -p 3000:3000 \
  arshif:latest
```

## 5. Reverse proxy

Forward HTTPS traffic to `127.0.0.1:3000`. Keep the container port private and expose only ports 80 and 443 publicly.

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
