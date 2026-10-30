# syntax=docker/dockerfile:1

# ---- Stage 1: deps, hanya dependency, ter-cache selama package*.json tak berubah
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Stage 2: builder, source code + build (perubahan kode tidak menginvalidasi layer deps)
FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules

# NEXT_PUBLIC_* di-inline saat build (perilaku Next.js). Dikirim sebagai build-args;
# docker compose mengisinya dari .env.production lewat --env-file.
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

COPY . .
ENV NODE_ENV=production
RUN npm run build

# ---- Stage 3: runner, runtime minimal non-root
FROM node:22-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Standalone output sudah memuat public/ dan .next/static (disalin oleh script build).
# Aplikasi butuh akses tulis ke .next/cache (ISR dsb.) -> chown ke user node (uid 1000).
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node

EXPOSE 3000

# Healthcheck: PWA manifest harus ter-serve (node fetch, tanpa curl/wget di slim image)
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/manifest.json').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
