# Arshif Architecture & Security Baseline

## 1. Product, Principals, Authority, and Protected Resources
Arshif is a cross-border multi-currency personal finance assistant (IDR/MYR/TRY/USD) featuring AI receipt/voice/bank-PDF transaction ingestion, Android notification banking capture ("Smart Log"), multi-account wallets/credit limits, budgeting, planning (goals, bills, debts, subscriptions, split bills), invoices, live-priced asset tracking, AI Coach, and AES-256-GCM encrypted backups.
- **Principals:** Unauthenticated guests (`anon`), Free users, Premium users, Suspended users (`profiles.suspended_at` + Auth ban), Web Admins (`public.admin_users`), Payment Webhooks (Xendit, Paddle, RevenueCat), `pg_cron`/`pg_net` jobs (`x-cron-secret`), and co-installed local mobile apps.
- **Protected Resources:** Multi-tenant financial ledgers (`accounts`, `transactions`, `transaction_items`, `budgets`, `goals`, `bills`, `debts`, `subscriptions`, `split_bills`, `invoices`, `assets`, `asset_price_alerts`, `smartlog_items`), private storage objects (`receipts`, `statements`, `avatars`), user credentials/OAuth/Drive tokens, subscription entitlements (`profiles.plan`, `orders`), admin controls, and operator-billed AI/Maps quotas (`GEMINI_API_KEY`, `GOOGLE_MAPS_API_KEY`).

## 2. Comparable Software Baseline
Documentation (`docs/arshif-prd.md`) compares Arshif to personal-finance/expense apps **Worthful v1.1** and **Belanje v5.2.2** for Android `NotificationListenerService` capture, credit limit groups, payday-anchored budgets, and Expo OTA updates, alongside multi-rail SaaS billing (RevenueCat + Xendit + Paddle). In this product class, common security pressure points are client-trusted plan/quota bypass, prompt/output injection into structured ledgers, webhook replay/forgery, WebView/iframe origin escapes, and device-local notification or backup exposure.

## 3. Tech Stack, Deployment Paths, and Offline Execution Limits
- **Client:** Expo SDK 58 (React Native `0.88.1`, Expo Router, TypeScript strict), React Native Web on Vercel (`vercel.json`), custom native Kotlin/Swift modules (`modules/smart-log`, `modules/doc-scanner`), and `plugins/withNoDataExtraction.js`. Platform split selects `.web.ts(x)` vs `.native.ts(x)` and `Platform.OS` branches for Store IAP vs Web checkout, WebView vs `<iframe>`, `SecureStore` vs non-persisted web backup keys, and Android-only Smart Log.
- **Backend:** Supabase Postgres 17 (`supabase/migrations/20261105000001..20261122000029`), Storage (`receipts`, `statements`, `avatars`), Auth (Email OTP/password + Google OAuth), Vault + `pg_cron`/`pg_net`, and 18 Deno 2 Edge Functions (`supabase/functions/*`) with `verify_jwt = false` in `supabase/config.toml`.
- **Execution Limits:** Host kernel enforces `apparmor_restrict_unprivileged_userns=1` and lacks `bwrap`, `firejail`, `nsjail`, `deno`, Docker socket access, JDK/Android SDK, and Xcode. Therefore zero target-controlled code (`jest`, `db-test.mjs`, `smartlog-flow.mjs`, `tsc`, `expo`) is executed; all checks remain strictly source-only (`method: "source"`, `artifact: null`).

## 4. Entry Surfaces and Source-to-Sink Paths
- **Edge Functions (`supabase/functions/*/index.ts`):** All HTTP POST JSON/text entry points (`scan-receipt`, `voice-log`, `import-statement`, `coach`, `coach-ask`, `coach-price`, `places`, `symbol-search`, `checkout-create`, `entitlement-sync`, `admin-user`, `delete-account`, `fx-sync`, `asset-prices-sync`, `planning-reminders`, and 3 billing webhooks) feeding Gemini API, Google Places/Static Maps, Yahoo/CoinGecko/Gold/TradingView feeds, RevenueCat/Xendit/Paddle APIs, and `service_role` DB/Storage mutations.
- **PostgREST & RPCs (`src/data/remote/*`, `src/lib/*`):** Direct client table CRUD, signed URLs, Realtime subscriptions (`notifications`, `orders`), and `SECURITY DEFINER` RPCs (`restore_rows`, `smartlog_ingest`, `bill_mark_paid`, `invoice_mark_paid`, `feature_gate`, `my_usage`, `admin_*`).
- **Browser / Client (`src/app/*`, `src/features/*`, `src/lib/*`):** OAuth fragment capture (`google.ts`, `driveToken.ts`), `returnTo` (`sessionStorage`), WebView/iframe chart embeds (`PriceChart*.tsx`, `chartHtml.ts`), HTML/PDF printing (`pdf/html.ts`, `pdf/share.ts`), CSV export (`exportData.ts`), Paddle.js dynamic script (`paddle.web.ts`), direct FX CDN fetches (`fxLatest.ts`), and AES-256-GCM `.arshif` backup/Drive sync.
- **Mobile & Deployment (`modules/*`, `plugins/*`, `scripts/*`, `app.json`):** Android `SmartLogListenerService` -> `CaptureStore` -> `parser.ts` -> `smartlog_ingest`, ML Kit/VisionKit `DocScannerModule`, `arshif://masuk` deep link, `deploy-supabase.sh`, and Expo OTA updates.

## 5. Trust Boundaries and Strongest Source-Visible Controls
- **Edge Auth & Webhooks:** `requireUser` calls `auth.getUser(token)`; `admin-user`/`fx-sync`/`asset-prices-sync` verify `admin_users` or `safeEqual(x-cron-secret, CRON_SECRET)`; webhooks verify static tokens (`xendit`, `revenuecat`) or HMAC-SHA256 + 300s timestamp window (`paddle`) and claim idempotency via `webhook_claim`.
- **Database Isolation & Quotas:** `revoke all` default + RLS (`user_id = auth.uid()`) + column-level `GRANT`s + triggers checking FK ownership (`transactions_owner`, `planning_check_refs`), server balance/invoice recomputation, `pg_advisory_xact_lock` quota counters (`effective_plan`, `quota_try_consume`, `enforce_total_limit`), and `assert_admin()` in admin RPCs.
- **Storage & Backup:** Private buckets scoped to `(storage.foldername(name))[1] = auth.uid()::text`; `restore_rows` allowlists 17 tables and intersects `role_column_grants`; `withNoDataExtraction` sets `allowBackup=false` + Android data extraction exclusions.
- **Client & AI:** OAuth fragments gated by `sessionStorage` CSRF flags (`arshif.auth.google`, `arshif.drive.state`); `vercel.json` sets `X-Frame-Options: DENY` and `frame-ancestors 'none'`; AI inputs use Gemini `responseSchema` + `_shared/normalize.ts` + `runAiJob` atomic quota consume/refund.

## 6. Repository-Relative Starting Paths
`supabase/config.toml`, `supabase/migrations/`, `supabase/functions/`, `src/app/`, `src/features/`, `src/lib/`, `src/data/`, `src/state/`, `src/config/public.ts`, `modules/smart-log/`, `modules/doc-scanner/`, `plugins/withNoDataExtraction.js`, `scripts/`, `app.json`, `eas.json`, `vercel.json`, `package.json`.

## 7. Prior Coverage State
None. No prior `coverage-ledger.json` or `findings.json` exists for `arshif`.

## 8. Companion Selection Summary
- `WEB-PROTOCOL-AND-AUTH.md`: Edge HTTP/`verify_jwt=false`, CORS, OAuth/state, sessions vs `suspended_at`, framing headers.
- `DATA-ISOLATION-AND-LIFECYCLE.md`: Postgres RLS/column grants/RPCs, private storage, deletion, AES-GCM backup/restore, AI caches.
- `AI-AND-LLM.md`: Gemini OCR/voice/PDF/coach prompts, schema normalization, quota/agency boundaries.
- `CLIENT-SIDE.md`: Web `srcDoc` iframe/WebView, HTML/PDF/CSV sinks, `localStorage`/`sessionStorage`, dynamic CDN/Paddle scripts.
- `DESKTOP-MOBILE-AND-LOCAL-IPC.md`: Android `NotificationListenerService`, `CaptureStore`, `DocScanner`, `arshif://` deep links, backup flags.
- `PROTOCOLS-RPC-AND-MESSAGING.md`: Webhook auth/replay/idempotency, entitlement order/sync concurrency, `pg_net` cron calls.
- `RESOURCE-EXHAUSTION-AND-AVAILABILITY.md`: Per-isolate rate limits, order-flooding, PDF/audio/restore/storage amplification, market feed fan-out.
- `CLOUD-AND-DEPLOYMENT.md`: Supabase deployment scripts/Vault, `supabase/config.toml`, runtime env switches (`PADDLE_ENV`, `APP_URL`), `vercel.json`.
- `SUPPLY-CHAIN-AND-RELEASE.md`: `import_map.json`, unofficial TradingView dep, unpinned CDN/widget scripts, Expo OTA update config.
- **Excluded:** `MEMORY-SAFETY-AND-BINARY.md` (pure managed TS/SQL/Kotlin/Swift without C/FFI/unsafe memory or custom binary loaders).
