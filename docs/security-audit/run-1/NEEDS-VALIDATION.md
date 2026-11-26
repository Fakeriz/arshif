# Unresolved Security Leads (`needs_validation`)

> **Target:** `arshif` (`72818060cbb72c5d9e8fe677a0f44e0ee23a26a2`)  
> **Run ID:** `arshif-run-1` | **Profile:** `standard` | **Policy:** `sandboxed-source-and-local-only`  
> **Notice:** All 25 records below are source-grounded, two-pass independently verified (`Phase 3` + `Phase 5`) candidates retained as `needs_validation` because host OS sandbox restrictions forbid executing target-controlled code and external deployment/runtime configuration resides outside the repository. **No severity ratings are assigned** until dynamic local reproduction and/or owner-observed deployment checks resolve the listed blockers.

## Index by Domain

| # | Domain | Fingerprint | Title |
|---:|---|---|---|
| 1 | Authentication, OAuth & Session Lifecycle | `arshif.auth.google-oauth.static-pending-implicit-flow` | [Web Google OAuth uses implicit fragment flow with static sessionStorage sentinel instead of PKCE or per-flow state](#lead-1) |
| 2 | Authentication, OAuth & Session Lifecycle | `arshif.auth.recovery.sessions-not-revoked-on-password-reset` | [Password recovery OTP flow updates password without revoking pre-existing sessions on other devices](#lead-2) |
| 3 | Authentication, OAuth & Session Lifecycle | `mobile-oauth/custom-scheme-arshif-implicit-callback` | [Unverified custom URI scheme (arshif://) and implicit OAuth token delivery allow native OAuth callback hijacking and session injection](#lead-3) |
| 4 | Authentication, OAuth & Session Lifecycle | `supabase/functions/_shared/auth.ts:requireUser::suspended_at-and-session-invalidation-bypass` | [Suspended users may retain Edge Function access until JWT expiry because active sessions are not invalidated and requireUser omits suspension checks](#lead-4) |
| 5 | Postgres RLS, Triggers & RPC Integrity / DoS | `arshif:resource-limits:restore-rows-single-row-trigger-and-subxact-amplification` | [restore_rows executes up to 500 single-row INSERT statements in subtransactions, defeating statement-level balance recomputation without rate limits or statement_timeout](#lead-5) |
| 6 | Postgres RLS, Triggers & RPC Integrity / DoS | `postgres/tables-rls/debt-payments-trigger-order-missing-owner` | [debt_payments_apply Trigger Fires Before Ownership Check Without user_id Filter, Exposing Cross-Tenant Debt Oracle and ON CONFLICT Balance Corruption](#lead-6) |
| 7 | Postgres RLS, Triggers & RPC Integrity / DoS | `postgres/tables-rls/notif-prefs-unvalidated-planning-reminders-dos` | [Unvalidated profiles.notif_prefs JSONB Allows Any User to Abort Hourly planning_reminders and price_alerts Cron for All Tenants](#lead-7) |
| 8 | Billing, Entitlements, Webhooks & Payment Environment Parity | `arshif:resource-limits:entitlement-sync-per-isolate-rate-limit-bypass` | [Per-isolate in-memory rate limit bypass and unpruned Map in entitlement-sync against shared RevenueCat API and database sync RPCs](#lead-8) |
| 9 | Billing, Entitlements, Webhooks & Payment Environment Parity | `billing/entitlement-grant-refund-race` | [Non-atomic RevenueCat HTTP calls outside Postgres advisory locks allow refunded orders to retain or regain Premium entitlement](#lead-9) |
| 10 | Billing, Entitlements, Webhooks & Payment Environment Parity | `billing/refund-shift-prelock-stale-read` | [refund_shift reads order state before acquiring pg_advisory_xact_lock, allowing concurrent refund calls to double-shift stacked paid orders](#lead-10) |
| 11 | Billing, Entitlements, Webhooks & Payment Environment Parity | `deploy/paddle-env-sandbox-default-drift` | [Silent sandbox fallback and missing payment-environment parity checks across checkout and webhooks](#lead-11) |
| 12 | Billing, Entitlements, Webhooks & Payment Environment Parity | `webhooks/out-of-order-refund-acked` | [Out-of-order refund webhooks for pending/expired/failed orders are silently ignored and marked processed, allowing subsequent payment webhook to grant Premium](#lead-12) |
| 13 | Billing, Entitlements, Webhooks & Payment Environment Parity | `webhooks/xendit-null-refund-amount-coercion` | [Xendit refund.succeeded coerces null refund amount to 0 and skips entitlement revocation as partial_refund](#lead-13) |
| 14 | External Proxies, AI/LLM Pipelines & Shared Quota / Resource Limits | `arshif:external-proxies:asset-prices-sync-unbounded-custom-symbols-starvation` | [Unvalidated and unbounded custom asset symbols in public.assets starve hourly asset-prices-sync and amplify Yahoo/TradingView traffic](#lead-14) |
| 15 | External Proxies, AI/LLM Pipelines & Shared Quota / Resource Limits | `arshif:external-proxies:symbol-search-per-isolate-rate-limit-yahoo-ip-ban` | [Per-isolate in-memory rate limit and evictable cache in symbol-search allow bypassing Yahoo Finance throttling from shared server IP](#lead-15) |
| 16 | External Proxies, AI/LLM Pipelines & Shared Quota / Resource Limits | `arshif:resource-limits:ai-ingestion-representation-amplification-and-unreadable-refund` | [Missing content validation, unbounded VoiceAccount strings, ~5-6x isolate memory expansion, and post-AI unreadable quota refunds across AI ingestion Edge Functions](#lead-16) |
| 17 | External Proxies, AI/LLM Pipelines & Shared Quota / Resource Limits | `supabase/functions/_shared/guard.ts:runAiJob-post-inference-quota-refund` | [Post-inference quota_refund in runAiJob bypasses daily and monthly AI usage quotas](#lead-17) |
| 18 | Data Lifecycle, Account Deletion, Backup & Local State Isolation | `account-deletion/incomplete-storage-cleanup-on-failure-and-nested-paths` | [Account deletion leaves private storage objects orphaned and allows pagination amplification via cleanup failures, nested paths, and unbounded storage uploads](#lead-18) |
| 19 | Data Lifecycle, Account Deletion, Backup & Local State Isolation | `arshif.state.signout.stale-reload-cross-account-leak` | [In-flight AppStore and feature-provider reloads and pending refs are not invalidated on sign-out, leaking prior user's state and route-guard flags into the next session](#lead-19) |
| 20 | Data Lifecycle, Account Deletion, Backup & Local State Isolation | `backup/drive-token-and-recovery-key-persist-across-delete-and-signout` | [Backup recovery key, Google Drive OAuth token, and backup/Drive metadata persist across account deletion and sign-out](#lead-20) |
| 21 | Data Lifecycle, Account Deletion, Backup & Local State Isolation | `smartlog/logout-race-and-capturestore-queue-leakage` | [SmartLog CaptureStore queue race, unguarded re-enable, and non-cancellable processNow allow bank notifications to cross logout onto a subsequent user](#lead-21) |
| 22 | Client WebView, Supply Chain & Mobile OTA Release Security | `arshif.client.pricechart.srcdoc-same-origin-sandbox` | [PriceChart web srcDoc iframe grants allow-same-origin alongside allow-scripts to external TradingView widget](#lead-22) |
| 23 | Client WebView, Supply Chain & Mobile OTA Release Security | `release/expo-updates-missing-code-signing` | [Expo OTA updates enabled on load without codeSigningCertificate or codeSigningMetadata verification](#lead-23) |
| 24 | Client WebView, Supply Chain & Mobile OTA Release Security | `supply-chain/unpinned-third-party-runtime-scripts` | [Unpinned third-party CDN scripts loaded without SRI or script-src CSP in authenticated web origin and allow-same-origin srcDoc iframe](#lead-24) |
| 25 | Client WebView, Supply Chain & Mobile OTA Release Security | `webview-origin-escape-unallowlisted-linking-openurl:src/features/assets/PriceChart.tsx` | [Un-allowlisted Linking.openURL scheme dispatch and subframe/data-URI navigation bypass in native PriceChart WebView](#lead-25) |

---

## Authentication, OAuth & Session Lifecycle

<a id="lead-1"></a>

### 1. Web Google OAuth uses implicit fragment flow with static sessionStorage sentinel instead of PKCE or per-flow state

- **Fingerprint:** `arshif.auth.google-oauth.static-pending-implicit-flow`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
src/lib/supabase.ts leaves Supabase Auth in implicit flow without flowType: 'pkce', and src/features/auth/google.ts authorizes web URL fragment token consumption via a static sessionStorage sentinel ('1') with no per-request cryptographic state/PKCE binding and incomplete cleanup on non-completion.

**Description:**  
The Supabase client in src/lib/supabase.ts sets detectSessionInUrl: false and omits flowType: 'pkce', leaving @supabase/supabase-js (^2.119.0) in its default 'implicit' OAuth flow where tokens return in the URL fragment (#access_token and #refresh_token). On web, signInWithGoogle() in src/features/auth/google.ts writes a static '1' sentinel to sessionStorage['arshif.auth.google'] without generating a per-attempt state nonce or PKCE verifier, and captureAuthRedirect() only clears that sentinel if window.location.hash contains 'refresh_token=' or 'error_description='. If a user starts Google sign-in in a tab and abandons it (browser back-navigation, navigating away, or receiving an '#error=' hash without 'error_description='), '1' remains in sessionStorage for the rest of the tab's lifetime (even across subsequent email OTP/password login). Any subsequent same-tab navigation to '<origin>/#access_token=<attacker_jwt>&refresh_token=<attacker_rt>' causes captureAuthRedirect() to call supabase.auth.setSession(...) and switch the tab to the attacker's account (login CSRF / session fixation), exposing financial records and uploads entered in that session to the attacker.

**Ordered Trace:**
1. **`entrypoint`** — `src/app/_layout.tsx:42` (`module`): Calls captureAuthRedirect() unconditionally at web module boot whenever the browser navigates to the app origin, exposing window.location.hash from cross-site navigations or redirects.
2. **`propagation`** — `src/features/auth/google.ts:60` (`captureAuthRedirect`): Reads window.location.hash and returns early at line 61 when neither 'refresh_token=' nor 'error_description=' is present, leaving any residual 'arshif.auth.google' sentinel intact after browser back-navigation, flow abandonment, or '#error=' callbacks lacking 'error_description='.
3. **`propagation`** — `src/features/auth/google.ts:64` (`captureAuthRedirect`): Checks only static equality sessionStorage.getItem('arshif.auth.google') === '1' (written by signInWithGoogle at line 38 without any per-attempt state parameter or PKCE verifier) before removing the key at line 65.
4. **`propagation`** — `src/features/auth/google.ts:72` (`captureAuthRedirect`): Parses attacker-supplied access_token and refresh_token from window.location.hash via parseFragment(hash) (line 69) and invokes sessionFrom(params) whenever pending was true.
5. **`sink`** — `src/features/auth/google.ts:31` (`sessionFrom`): Calls supabase.auth.setSession({ access_token, refresh_token }), persisting the supplied session into client storage and emitting SIGNED_IN or TOKEN_REFRESHED to SessionProvider (src/state/session.tsx:19) without request-binding verification.

**Verified Source Evidence:**
- `src/lib/supabase.ts:14` — createClient configures auth with detectSessionInUrl: false (line 19) and omits flowType: 'pkce', leaving @supabase/supabase-js (^2.119.0, package.json:9) in its default 'implicit' flowType.
- `src/features/auth/google.ts:38` — On web, signInWithGoogle() writes static '1' to sessionStorage['arshif.auth.google'] and invokes supabase.auth.signInWithOAuth at line 42 with no per-request state nonce or PKCE challenge; line 43 also returns 'error' without clearing PENDING_KEY (though GoTrueClient._handleProviderSignIn returns error: null in implicit mode).
- `src/features/auth/google.ts:61` — captureAuthRedirect() returns early before sessionStorage.removeItem(PENDING_KEY) at line 65 when window.location.hash lacks 'refresh_token=' and 'error_description=', keeping '1' alive across back-navigation, abandonment, or '#error=' hashes without 'error_description='.
- `src/features/auth/google.ts:64` — captureAuthRedirect() gates supabase.auth.setSession (line 31) solely on sessionStorage.getItem(PENDING_KEY) === '1' with no cryptographic state comparison (unlike Google Drive OAuth in src/features/backup/driveToken.ts:45 and src/features/backup/drive.tsx:175).
- `src/app/(auth)/sambut.tsx:171` — Both SambutScreen (line 171) and MasukScreen (src/app/(auth)/masuk.tsx:136) call signInWithGoogle(), and neither email OTP/password verification (src/app/(auth)/verifikasi.tsx) nor SessionProvider (src/state/session.tsx:19) clears 'arshif.auth.google'.
- `vercel.json:7` — Configures X-Frame-Options: DENY and Content-Security-Policy: frame-ancestors 'none' (line 8) to prevent framing, but specifies no Cross-Origin-Opener-Policy header.

**Exact Blockers:**
- Host kernel enforces apparmor_restrict_unprivileged_userns=1 and lacks bwrap, firejail, nsjail, deno, and Docker; dynamic browser and Supabase Auth reproduction is blocked on this host.
- Hosted Supabase Auth project configuration (Google OAuth provider settings, allowed redirect URLs, exact error hash parameters emitted on OAuth cancellation/failure, and PKCE exchange compatibility across web origin and native arshif://masuk) is outside the repository.
- Deployed HTTP response headers on Vercel and Cross-Origin-Opener-Policy headers returned by Supabase Auth and Google IdP redirects during window.open flows reside outside the repository.

**Validation Plan:**
- **Local (Bounded Fixture):** Run a local web build against a local Supabase Auth instance with two dummy accounts: trigger signInWithGoogle() in a browser tab so sessionStorage['arshif.auth.google'] is '1', navigate Back (or simulate '#error=access_denied' without error_description=) and verify 'arshif.auth.google' persists (including after email OTP login), then navigate the same tab to '<origin>/#access_token=<dummy_account_2_jwt>&refresh_token=<dummy_account_2_rt>' and verify captureAuthRedirect() executes setSession and transitions SessionProvider to dummy account 2.
- **Deployment (Owner-Observed Read-Only):** Inspect the hosted Supabase Auth Dashboard redirect URL and Google provider configuration, confirm deployed Vercel and IdP COOP headers, and verify whether switching src/lib/supabase.ts to flowType: 'pkce' with exchangeCodeForSession works end-to-end on both the web origin and native 'arshif://masuk'.

---

<a id="lead-2"></a>

### 2. Password recovery OTP flow updates password without revoking pre-existing sessions on other devices

- **Fingerprint:** `arshif.auth.recovery.sessions-not-revoked-on-password-reset`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
src/app/(auth)/verifikasi.tsx performs recovery OTP verification followed by supabase.auth.updateUser({ password }) without calling supabase.auth.signOut({ scope: 'others' }), and leaves the newly created recovery session active with only a toast if updateUser fails.

**Description:**  
Across the client-to-Supabase-Auth trust boundary during password recovery, MasukScreen.forgot calls supabase.auth.resetPasswordForEmail and routes to /verifikasi?type=recovery, where VerifikasiScreen.verify calls supabase.auth.verifyOtp(..., type: 'recovery') and then supabase.auth.updateUser({ password }) without calling supabase.auth.signOut({ scope: 'others' }). Because SessionProvider (src/state/session.tsx) immediately activates any session emitted by onAuthStateChange (including PASSWORD_RECOVERY) and Routes (src/app/_layout.tsx) navigates into the authenticated app, pre-existing sessions and refresh tokens on other devices remain valid and able to refresh tokens or access user data unless the deployed Supabase Auth (GoTrue) server automatically revokes sibling sessions on PUT /user; furthermore, if updateUser fails, only an error toast (auth.verify.resetFailed) is shown while the newly minted recovery session stays active in the authenticated app and no sibling sessions are revoked.

**Ordered Trace:**
1. **`entrypoint`** — `src/app/(auth)/masuk.tsx:188` (`MasukScreen.forgot`): Initiates password recovery via supabase.auth.resetPasswordForEmail(parsed.data) and routes to /verifikasi?type=recovery (line 191).
2. **`propagation`** — `src/app/(auth)/verifikasi.tsx:57` (`VerifikasiScreen.verify`): Calls supabase.auth.verifyOtp({ email, token, type: 'recovery' }), which stores the recovery session and emits PASSWORD_RECOVERY to SessionProvider (src/state/session.tsx:19).
3. **`sink`** — `src/app/(auth)/verifikasi.tsx:67` (`VerifikasiScreen.verify`): Calls supabase.auth.updateUser({ password }) without invoking supabase.auth.signOut({ scope: 'others' }) to revoke pre-existing sessions and refresh tokens, and leaves the recovery session active if updateUser errors.

**Verified Source Evidence:**
- `src/app/(auth)/verifikasi.tsx:67` — Calls only supabase.auth.updateUser({ password }) during recovery; no supabase.auth.signOut({ scope: 'others' }) call exists in verifikasi.tsx, session.tsx, _layout.tsx, or anywhere in the repository.
- `src/app/(auth)/verifikasi.tsx:68` — When updateUser returns an error (upd), only displays an error toast (auth.verify.resetFailed) while the recovery session minted by verifyOtp at line 57 remains signed in.
- `src/state/session.tsx:19` — SessionProvider stores the session from onAuthStateChange((_event, session) => ...) without distinguishing PASSWORD_RECOVERY from SIGNED_IN, causing Routes in src/app/_layout.tsx (lines 117, 153-163) to leave (auth)/verifikasi immediately upon verifyOtp.
- `supabase/config.toml:166` — Configures jwt_expiry = 3600 with enable_refresh_token_rotation = true (line 172), refresh_token_reuse_interval = 10 (line 175), and secure_password_change = false (line 230), with no session-revocation setting or [auth.hook.*] enabled for password updates.
- `scripts/deploy-supabase.sh:56` — Patches hosted project Auth config via Management API only for mailer_otp_length, mailer_otp_exp, and magic_link/confirmation subjects and templates (lines 47-56), leaving password-update session revocation dependent on hosted GoTrue defaults.

**Exact Blockers:**
- Host sandbox blocks execution (source-only verification with no runnable local Docker/Supabase Auth GoTrue runtime), preventing local execution of recovery verifyOtp and PUT /user across two concurrent sessions to test whether GoTrue automatically revokes sibling auth.sessions and auth.refresh_tokens on password reset.
- Deployed Supabase Auth (GoTrue) server version and runtime Auth configuration on the hosted project (gyxtdpmruuhhkprlhlrk) are outside repository source and cannot be inspected under source-only and no-network rules.

**Validation Plan:**
- **Local (Bounded Fixture):** Against a local Supabase Auth stack started from supabase/config.toml using a bounded dummy user fixture signed into two independent sessions (Session A and Session B), execute resetPasswordForEmail, verifyOtp({ type: 'recovery' }), and updateUser({ password: newPassword }) on Session A (plus a separate run where updateUser fails, e.g. reusing the unchanged password to trigger same_password), then call refreshSession(), auth.getUser(), Edge Function requireUser endpoints, and PostgREST queries from Session B to observe whether Session B's refresh token, server session, and access JWT (within jwt_expiry = 3600) remain accepted.
- **Deployment (Owner-Observed Read-Only):** Have the project owner inspect the hosted Supabase Auth (GoTrue) version, Auth configuration (e.g. GET /v1/projects/gyxtdpmruuhhkprlhlrk/config/auth), and Auth audit/session logs or GoTrue release behavior for PUT /user password updates to observe whether sibling auth.sessions and auth.refresh_tokens are automatically revoked on password recovery.

---

<a id="lead-3"></a>

### 3. Unverified custom URI scheme (arshif://) and implicit OAuth token delivery allow native OAuth callback hijacking and session injection

- **Fingerprint:** `mobile-oauth/custom-scheme-arshif-implicit-callback`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
app.json configures only an unverified custom URI scheme ('arshif') without Android App Links (android.intentFilters with autoVerify) or iOS Universal Links (ios.associatedDomains), src/lib/supabase.ts leaves @supabase/supabase-js in implicit OAuth flow (omitting flowType: 'pkce'), and src/features/auth/google.ts accepts #access_token and #refresh_token fragments returned via WebBrowser.openAuthSessionAsync(..., 'arshif://masuk') into supabase.auth.setSession without PKCE or client-side callback state binding.

**Description:**  
On native Android and iOS builds, Google Sign-In uses Supabase implicit OAuth redirecting to the unverified custom URI scheme arshif://masuk without Android App Links, iOS Universal Links, PKCE, or client-side state/nonce verification. On Android, WebBrowser.openAuthSessionAsync falls back to Chrome Custom Tabs plus a Linking 'url' listener matching only event.url.startsWith('arshif://masuk'), allowing a co-installed Android app declaring arshif:// (or arshif://masuk) to compete for or intercept the OAuth redirect containing plaintext access_token and refresh_token fragments, or to inject attacker-controlled session tokens via an ACTION_VIEW Intent while sign-in is in progress. On iOS, ASWebAuthenticationSession likewise uses callbackURLScheme 'arshif' with implicit fragment tokens and no Universal Links ownership binding.

**Ordered Trace:**
1. **`entrypoint`** — `app.json:8` (`expo.scheme`): Registers unverified custom URI scheme 'arshif' with empty ios.infoPlist (no associatedDomains) and no android.intentFilters (no autoVerify App Links).
2. **`propagation`** — `src/lib/supabase.ts:14` (`supabase`): Initializes createClient without flowType: 'pkce', leaving @supabase/auth-js on default flowType: 'implicit' so OAuth redirects deliver bearer tokens in URL fragments.
3. **`propagation`** — `src/features/auth/google.ts:45` (`signInWithGoogle`): Builds redirectTo = Linking.createURL('masuk') ('arshif://masuk'), initiates signInWithOAuth without PKCE or client state/nonce, and awaits WebBrowser.openAuthSessionAsync(data.url, redirectTo) (which on Android matches any Linking 'url' event starting with 'arshif://masuk').
4. **`sink`** — `src/features/auth/google.ts:31` (`sessionFrom`): Extracts access_token and refresh_token from res.url fragment via parseFragment and commits them directly with supabase.auth.setSession({ access_token, refresh_token }).

**Verified Source Evidence:**
- `app.json:8` — Sets expo.scheme to 'arshif' while omitting android.intentFilters (App Links) and ios.associatedDomains (Universal Links).
- `src/lib/supabase.ts:14` — Configures Supabase auth client with detectSessionInUrl: false and AsyncStorage, omitting flowType: 'pkce' (defaults to 'implicit' in @supabase/auth-js).
- `src/features/auth/google.ts:48` — Native signInWithGoogle awaits WebBrowser.openAuthSessionAsync(data.url, redirectTo) where redirectTo resolves to 'arshif://masuk', then passes res.url fragments directly to sessionFrom/setSession at lines 31 and 50 without PKCE or state verification.
- `src/app/(auth)/masuk.tsx:136` — User-facing Sign In screen invokes signInWithGoogle() (also invoked on Welcome screen in src/app/(auth)/sambut.tsx:171).

**Exact Blockers:**
- Host kernel enforces apparmor_restrict_unprivileged_userns=1 and lacks bwrap, firejail, nsjail, Docker, Android SDK, and Xcode, preventing expo prebuild, APK/IPA compilation, and emulator/simulator execution.
- The prebuilt AndroidManifest.xml / iOS Info.plist, Android Custom Tabs intent disambiguation behavior when a co-installed app registers arshif://masuk, explicit-package Intent injection during openAuthSessionAsync, and live Supabase Redirect URLs allowlist configuration cannot be observed without native build and emulator/device execution.

**Validation Plan:**
- **Local (Bounded Fixture):** In an isolated sandbox with Android SDK/Xcode, run expo prebuild to inspect the generated AndroidManifest.xml intent-filter (android:scheme="arshif" without autoVerify) and iOS Info.plist/entitlements (no associated-domains). On an isolated Android emulator with a dummy co-installed APK declaring <data android:scheme="arshif" android:host="masuk" />, trigger signInWithGoogle() against a local/mock OAuth redirect using dummy credentials to verify (1) whether the dummy APK intercepts or prompts for the arshif://masuk#access_token=...&refresh_token=... redirect from Chrome Custom Tabs, and (2) whether firing an ACTION_VIEW Intent (including targeting package app.arshif) with dummy user-B tokens while openAuthSessionAsync is open commits user B's session via supabase.auth.setSession.
- **Deployment (Owner-Observed Read-Only):** In the Supabase dashboard for project gyxtdpmruuhhkprlhlrk, verify whether Google OAuth is enabled and arshif://masuk is allowlisted under Auth Redirect URLs, and confirm in an isolated staging/preview build with dummy test accounts whether /auth/v1/authorize redirects to arshif://masuk with #access_token and #refresh_token fragments.

---

<a id="lead-4"></a>

### 4. Suspended users may retain Edge Function access until JWT expiry because active sessions are not invalidated and requireUser omits suspension checks

- **Fingerprint:** `supabase/functions/_shared/auth.ts:requireUser::suspended_at-and-session-invalidation-bypass`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
admin-user suspend sets Auth ban_duration and profiles.suspended_at without revoking existing sessions, and requireUser in supabase/functions/_shared/auth.ts accepts any user returned by adminClient().auth.getUser(token) without checking data.user.banned_until or profiles.suspended_at.

**Description:**  
When an admin suspends a user via supabase/functions/admin-user/index.ts, the handler sets Auth ban_duration ('876000h') via auth.admin.updateUserById and sets profiles.suspended_at, without terminating existing sessions in auth.sessions (auth.admin.signOut requires a user JWT rather than a userId, so admin-user cannot invoke it directly). Across all 18 Edge Functions (configured with verify_jwt = false in supabase/config.toml), requireUser in supabase/functions/_shared/auth.ts validates bearer tokens solely by calling adminClient().auth.getUser(token) and checking error || !data.user, without inspecting data.user.banned_until or querying profiles.suspended_at. None of the 11 user-authenticated Edge Functions check profiles.suspended_at downstream, and across all 33 Postgres migrations (20261105000001_schema.sql through 20261122000029_card_details.sql) no RLS policy or user-callable RPC checks profiles.suspended_at (it only filters admin broadcasts). Per docs/fase8-admin.md and admin-user comments, banning only blocks new logins and token refreshes while pre-existing access tokens remain valid up to jwt_expiry (3600s in supabase/config.toml), relying on the client UI (SuspendedScreen in src/app/_layout.tsx) to withhold access. If the deployed Supabase Auth GoTrue GET /auth/v1/user endpoint does not reject pre-issued JWTs of banned users (or if profiles.suspended_at is set without an Auth ban), a suspended user can call Edge Functions directly with an existing JWT to invoke operator-billed AI/Maps APIs, create checkout orders, or sync/delete account state.

**Ordered Trace:**
1. **`entrypoint`** — `supabase/functions/_shared/http.ts:26` (`serve`): Edge Function HTTP gateway wrapper accepts POST requests carrying a pre-suspension user Bearer JWT because supabase/config.toml sets verify_jwt = false across all 18 Edge Functions.
2. **`propagation`** — `supabase/functions/_shared/auth.ts:22` (`requireUser`): requireUser calls adminClient().auth.getUser(token) and checks only error || !data.user at line 23, omitting checks on data.user.banned_until and profiles.suspended_at.
3. **`sink`** — `supabase/functions/_shared/auth.ts:24` (`requireUser`): requireUser returns { id: data.user.id }, admitting a suspended principal into downstream user-authenticated Edge Functions (e.g., scan-receipt, voice-log, import-statement, coach, coach-ask, coach-price, places, symbol-search, checkout-create, entitlement-sync, delete-account) until JWT expiration (3600s) unless GoTrue /auth/v1/user rejects the token.

**Verified Source Evidence:**
- `supabase/config.toml:166` — jwt_expiry is configured as 3600 seconds (1 hour) and lines 427-499 set verify_jwt = false across all 18 Edge Functions.
- `supabase/functions/admin-user/index.ts:48` — Suspend calls db.auth.admin.updateUserById(userId, { ban_duration: BAN_FOREVER }) and line 50 sets profiles.suspended_at without revoking existing Auth sessions.
- `supabase/functions/_shared/auth.ts:18` — requireUser(req) checks only adminClient().auth.getUser(token) (lines 22-24) and omits any check on data.user.banned_until or profiles.suspended_at.
- `supabase/functions/scan-receipt/index.ts:16` — Downstream Edge Functions such as scan-receipt (line 16), places (line 50), and checkout-create (line 16) rely solely on requireUser(req) and do not check profiles.suspended_at before invoking Gemini, Google Maps, or billing/order mutations.
- `supabase/migrations/20261112000014_admin.sql:7` — Adds profiles.suspended_at; across all 33 migrations (20261105000001 through 20261122000029), suspended_at is checked only in admin_broadcast and admin_broadcast_count (lines 184, 202) and never in RLS policies or user RPCs.
- `docs/fase8-admin.md:54` — Documents that banning rejects new logins and refresh tokens while pre-existing access tokens remain valid until expiry (max 1 hour), relying on the app UI screen to block access.
- `src/app/_layout.tsx:132` — Routes component blocks suspended users in client UI via if (signedIn && state.suspended) return <SuspendedScreen />, after AppStoreProvider fetches profile data via PostgREST using the existing JWT.

**Exact Blockers:**
- Host OS sandbox isolation controls are unavailable on this machine (apparmor_restrict_unprivileged_userns=1, no bwrap/firejail/nsjail/deno/Docker isolation), preventing local Edge Function or Supabase Auth GoTrue execution.
- Deployed Supabase Auth GoTrue runtime behavior for GET /auth/v1/user (called by adminClient().auth.getUser(token)) on a pre-existing valid JWT after ban_duration is set—whether GoTrue rejects it with an error or returns 200 with banned_until set—is outside repository source visibility.

**Validation Plan:**
- **Local (Bounded Fixture):** In an isolated local Supabase stack (supabase start) with dummy user and admin accounts, sign in as the dummy user to capture a valid access_token, suspend that user via POST /functions/v1/admin-user (action='suspend') as the dummy admin, and send direct POST requests with the pre-suspension access_token to self-contained requireUser-protected Edge Functions (such as /functions/v1/entitlement-sync with {} when RevenueCat secrets are unset, or {} to any requireUser-protected Edge Function to distinguish 401 unauthorized from 400 bad_request) to observe whether adminClient().auth.getUser(token) returns 401 or admits execution. Also set profiles.suspended_at without an Auth ban in local Postgres and confirm requireUser still permits Edge Function access.
- **Deployment (Owner-Observed Read-Only):** Owner-observed check on the deployed Supabase project (gyxtdpmruuhhkprlhlrk), without sending audit traffic: inspect the Supabase Auth (GoTrue) runtime version and Dashboard Auth configuration (including whether any Auth Hooks are enabled outside supabase/config.toml) to confirm whether GET /auth/v1/user rejects pre-issued JWTs when auth.users.banned_until is in the future or returns 200 with banned_until set until jwt_expiry (3600s), and inspect auth.users, auth.sessions, profiles, and existing Auth/Edge Function logs to verify whether any suspended accounts (profiles.suspended_at IS NOT NULL) lack a matching future banned_until or retain active sessions.

---

## Postgres RLS, Triggers & RPC Integrity / DoS

<a id="lead-5"></a>

### 5. restore_rows executes up to 500 single-row INSERT statements in subtransactions, defeating statement-level balance recomputation without rate limits or statement_timeout

- **Fingerprint:** `arshif:resource-limits:restore-rows-single-row-trigger-and-subxact-amplification`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
public.restore_rows iterates over up to 500 JSONB elements and executes a separate dynamic INSERT ... ON CONFLICT DO UPDATE inside a per-element BEGIN ... EXCEPTION WHEN OTHERS subtransaction without call rate limiting or statement_timeout, defeating statement-level trigger batching in transactions_balance_stmt and amplifying O(T) recompute_balance account scans while overflowing Postgres's 64-subxid cache.

**Description:**  
The SECURITY DEFINER RPC public.restore_rows(p_table, p_rows) is granted to authenticated (self-signup is enabled in supabase/config.toml) and caps p_rows at 500 elements per call, without per-user call rate limits, a function-level statement_timeout, per-element key-count bounds, or a total row cap on tables such as public.transactions. Inside its loop, restore_rows runs up to 500 separate dynamic SQL INSERT ... ON CONFLICT DO UPDATE statements, each wrapped in a PL/pgSQL BEGIN ... EXCEPTION WHEN OTHERS subtransaction block. For public.transactions, each single-row statement fires the statement-level balance triggers (transactions_balance_ins/upd -> transactions_balance_stmt) individually, calling recompute_balance once per row (twice for transfers, up to 1,000 full-account SUM aggregations and public.accounts updates per call; up to 2,000 if updates move both accounts), defeating the FOR EACH STATEMENT batching introduced in 20261116000021_balance_per_statement.sql. Each write-performing subtransaction also allocates a subxid; exceeding 64 per transaction overflows Postgres's per-backend PGPROC subxid cache into pg_subtrans SLRU lookups for concurrent sessions across shared database pools. An authenticated user can cheaply populate T transactions via bulk PostgREST inserts and then replay the same 500 existing transfer IDs in restore_rows to amplify O(500 * T) to O(1,000 * T) scans per HTTP call (up to O(2,000 * T) if updates move both accounts).

**Ordered Trace:**
1. **`entrypoint`** — `supabase/migrations/20261122000026_restore_rows.sql:9` (`public.restore_rows(text, jsonb)`): Any authenticated user (with execute granted at line 93 and self-signup enabled) invokes public.restore_rows via PostgREST with p_table='transactions' and up to 500 JSONB rows (capped at line 45 without rate limits, key-count caps, or statement_timeout).
2. **`propagation`** — `supabase/migrations/20261122000026_restore_rows.sql:66` (`restore_rows per-element loop`): Loops up to 500 times over p_rows, scanning jsonb_object_keys(r) twice (lines 69-70) and executing a separate dynamic INSERT ... ON CONFLICT DO UPDATE statement (line 78) inside a BEGIN ... EXCEPTION WHEN OTHERS subtransaction block (lines 67-86).
3. **`propagation`** — `supabase/migrations/20261116000021_balance_per_statement.sql:8` (`public.transactions_balance_stmt()`): Each individual INSERT/UPDATE statement on public.transactions fires transactions_balance_ins/upd (lines 28-31), invoking transactions_balance_stmt once per row instead of once per 500-row batch and calling recompute_balance for every distinct account_id and to_account_id in that row (lines 21-23).
4. **`sink`** — `supabase/migrations/20261105000001_schema.sql:131` (`public.recompute_balance(uuid)`): Aggregates SUM(...) across all T rows in public.transactions matching account_id or to_account_id and updates public.accounts (lines 136-146), causing up to 500-1,000 full-account scans (or up to 2,000 when updates move both accounts) and account row updates per RPC call alongside >64 subtransaction XID allocations.

**Verified Source Evidence:**
- `supabase/migrations/20261122000026_restore_rows.sql:45` — Caps p_rows at 500 elements per call without per-user call rate limits, object key-count limits, or function-level statement_timeout.
- `supabase/migrations/20261122000026_restore_rows.sql:66` — Executes up to 500 separate dynamic SQL INSERT ... ON CONFLICT DO UPDATE statements (line 78) inside per-row BEGIN ... EXCEPTION WHEN OTHERS subtransactions (lines 67-86); line 93 grants execute to authenticated.
- `supabase/migrations/20261116000021_balance_per_statement.sql:1` — Documents that per-row recompute_balance on a 500-row import to a 10,000-transaction account caused 500 x 10,000 reads and lock contention, motivating replacement of the row trigger with FOR EACH STATEMENT triggers (lines 28-33) that restore_rows defeats by issuing 500 separate statements.
- `supabase/migrations/20261105000001_schema.sql:131` — public.recompute_balance(uuid) scans all public.transactions rows matching account_id or to_account_id to recompute balance and updates public.accounts; transfer_shape (lines 80-83) requires distinct account_id and to_account_id for transfers.
- `scripts/db-test.mjs:95` — Verifies transactions_balance_del/ins/upd are FOR EACH STATEMENT triggers (per_row = false at lines 97-102) and only tests restore_rows with 0-4 rows (lines 994-1034).
- `supabase/migrations/20261110000012_invoices.sql:121` — On p_table='invoices', BEFORE INSERT triggers invoices_a_quota (line 121) and invoices_b_number (line 123) run per row before ON CONFLICT resolution, executing quota_try_consume and invoice_counters upserts 500 times for Premium users.
- `supabase/config.toml:177` — Allows public signup (enable_signup = true) and sets api.max_rows = 1000 (line 18), with no PostgREST RPC rate limit or statement_timeout defined in repository config.

**Exact Blockers:**
- Host sandbox execution restrictions (and absence of a runnable local Postgres 17 / Docker instance) prohibit executing scripts/db-test.mjs or a multi-session local Postgres fixture to benchmark execution latency, shared buffer reads, and concurrent pg_subtrans SLRU contention of 500-row restore_rows calls against large accounts.
- Deployed Supabase platform controls outside repository source—specifically role statement_timeout for authenticated/authenticator, API gateway/PostgREST request body size and per-user rate limits, live auth signup/confirmation settings, and Supavisor pool size / DB compute tier—must be observed on the target deployment to quantify shared blast radius.

**Validation Plan:**
- **Local (Bounded Fixture):** In an isolated local Postgres 17 fixture (or PGlite for single-session baseline) containing one dummy user owning two accounts with 10,000 existing transfer transactions, measure and compare execution time, shared buffer hits/reads (via pg_stat_database / pg_statio_user_tables or auto_explain with log_nested_statements), and subtransaction XID allocation / pg_subtrans SLRU activity (pg_stat_slru) between one 500-row bulk INSERT ... ON CONFLICT DO UPDATE statement and one public.restore_rows('transactions', 500_rows) call.
- **Deployment (Owner-Observed Read-Only):** Ask the deployment owner to inspect (without sending audit traffic to the deployment) the live Supabase configuration and existing telemetry: Postgres statement_timeout for roles authenticated and authenticator (pg_roles / pg_db_role_setting), API gateway/PostgREST max payload size and per-user/IP RPC rate limits, Supavisor pool_mode/default_pool_size and DB compute tier, live auth signup/confirmation enforcement, and existing pg_stat_statements or pg_stat_slru ('Subtrans') metrics.

---

<a id="lead-6"></a>

### 6. debt_payments_apply Trigger Fires Before Ownership Check Without user_id Filter, Exposing Cross-Tenant Debt Oracle and ON CONFLICT Balance Corruption

- **Fingerprint:** `postgres/tables-rls/debt-payments-trigger-order-missing-owner`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
public.debt_payments_apply() is a BEFORE INSERT SECURITY DEFINER trigger that sorts alphabetically before debt_payments_refs, omits a user_id = new.user_id predicate when selecting and updating public.debts, and performs an UPDATE side-effect on public.debts before ON CONFLICT (id) DO NOTHING arbitration.

**Description:**  
Across all 33 Supabase Postgres migrations, public.debt_payments defines two BEFORE INSERT triggers: debt_payments_apply (20261108000008_planning.sql:285) and debt_payments_refs (line 213). Because PostgreSQL executes BEFORE INSERT row triggers in alphabetical order, debt_payments_apply() runs before debt_payments_refs and before RLS WITH CHECK evaluation. debt_payments_apply() is declared SECURITY DEFINER (bypassing debts_all RLS on public.debts) and executes SELECT * INTO d FROM public.debts WHERE id = new.debt_id FOR UPDATE without filtering user_id = new.user_id. Consequently, an authenticated caller inserting into public.debt_payments (directly via PostgREST INSERT/upsert or via public.restore_rows('debt_payments', ...), which surfaces sqlerrm in first_error) with a known or guessed victim debt_id UUID triggers 'debt_closed' (when paid) or 'payment_exceeds_balance' (when active and amount > balance) instead of 'debt_not_owned', revealing debt existence, paid/active status, and allowing binary-search recovery of the exact remaining balance (plus transient FOR UPDATE row locking). Additionally, because debt_payments has no UPDATE column grants, restore_rows('debt_payments', ...) (and PostgREST upsert ignore-duplicates) issues INSERT ... ON CONFLICT (id) DO NOTHING; PostgreSQL runs BEFORE INSERT trigger debt_payments_apply prior to conflict detection, so re-restoring a backup or inserting a duplicate payment id against an active debt decrements public.debts.balance (and can mark status = 'paid') without inserting a payment row and without rolling back the update.

**Ordered Trace:**
1. **`entrypoint`** — `supabase/migrations/20261108000008_planning.sql:413` (`public.debt_payments INSERT grant and public.restore_rows RPC`): Authenticated users hold INSERT (id, debt_id, amount, date, transaction_id) privilege on public.debt_payments (with user_id defaulting to auth.uid() at line 137 and RLS policy debt_payments_all at line 429) and EXECUTE privilege on public.restore_rows('debt_payments', ...) (supabase/migrations/20261122000026_restore_rows.sql:38,93).
2. **`propagation`** — `supabase/migrations/20261108000008_planning.sql:285` (`debt_payments_apply BEFORE INSERT trigger ordering`): PostgreSQL fires BEFORE INSERT FOR EACH ROW triggers alphabetically by name, executing debt_payments_apply prior to debt_payments_refs (line 213), prior to RLS WITH CHECK evaluation, and prior to ON CONFLICT (id) DO NOTHING conflict detection in restore_rows (supabase/migrations/20261122000026_restore_rows.sql:74-78).
3. **`sink`** — `supabase/migrations/20261108000008_planning.sql:272` (`public.debt_payments_apply()`): SECURITY DEFINER trigger runs `select * into d from public.debts where id = new.debt_id for update` without `user_id = new.user_id`, raising 'debt_closed' (line 274) or 'payment_exceeds_balance' (line 277) before debt_payments_refs checks ownership ('debt_not_owned', line 202), and executing `update public.debts` (lines 279-282) even if ON CONFLICT (id) DO NOTHING subsequently skips the duplicate debt_payments insert.

**Verified Source Evidence:**
- `supabase/migrations/20261108000008_planning.sql:186` — planning_check_refs() checks ownership (`where id = $1 and user_id = $2`) and raises '%_not_owned' ('debt_not_owned', errcode 42501) at line 202.
- `supabase/migrations/20261108000008_planning.sql:213` — Trigger debt_payments_refs invokes planning_check_refs() on BEFORE INSERT OR UPDATE, sorting alphabetically after debt_payments_apply.
- `supabase/migrations/20261108000008_planning.sql:267` — debt_payments_apply() is SECURITY DEFINER (line 268), selects from public.debts by id alone FOR UPDATE (line 272), raises 'debt_closed' (line 274) or 'payment_exceeds_balance' (line 277), and mutates debts.balance and debts.status (lines 279-282).
- `supabase/migrations/20261108000008_planning.sql:285` — Trigger debt_payments_apply attaches BEFORE INSERT on public.debt_payments, executing before debt_payments_refs and before ON CONFLICT DO NOTHING.
- `supabase/migrations/20261108000008_planning.sql:402` — debt_payments only grants SELECT (line 402) and INSERT (id, debt_id, amount, date, transaction_id) (line 413) to authenticated with no UPDATE or DELETE grants, while debts_all RLS (line 427) isolates public.debts.
- `supabase/migrations/20261122000026_restore_rows.sql:74` — restore_rows allowlists 'debt_payments' (line 38), resolves v_upd to NULL because debt_payments has no UPDATE column grants (lines 58-64), executes INSERT ... ON CONFLICT (id) DO NOTHING (lines 74-78), and captures sqlerrm into first_error (lines 85, 88).
- `src/lib/backup/data.ts:120` — restoreBackup sends all backed-up debts and debt_payments rows to supabase.rpc('restore_rows', ...) without deduplicating pre-existing payment IDs.
- `scripts/db-test.mjs:1009` — Re-restore idempotency test covers only transactions (lines 1009-1013) and debt payment tests (lines 332-340) do not test cross-tenant debt_id probes or restore_rows('debt_payments', ...).

**Exact Blockers:**
- Host OS kernel enforces apparmor_restrict_unprivileged_userns=1 and lacks bwrap, firejail, nsjail, and Docker, blocking local execution of PGlite (scripts/db-test.mjs) or PostgreSQL 17 to empirically observe the cross-tenant error strings and ON CONFLICT DO NOTHING balance decrement.
- Staging/deployed PostgREST error-forwarding behavior cannot be verified from repository source alone to confirm whether direct HTTP POST /rest/v1/debt_payments returns raw Postgres P0001/42501 exception messages verbatim (though src/data/remote/api.ts:31 relies on raw quota_* error messages and public.restore_rows explicitly returns sqlerrm in first_error).

**Validation Plan:**
- **Local (Bounded Fixture):** Inside an isolated sandbox running PGlite or PostgreSQL 17 with all non-cron migrations in supabase/migrations/ (20261105000001 through 20261122000029) applied, create dummy authenticated users A and B: (1) As A, insert an active debt D_active (principal = 1000000) and a paid debt D_paid (principal = 500000 with a full payment). As B (role authenticated, request.jwt.claim.sub = B), test both direct INSERT INTO public.debt_payments and SELECT public.restore_rows('debt_payments', ...) with D_paid, D_active (amount = 1500000), D_active (amount = 500000), and a random unused UUID, confirming distinct responses ('debt_closed', 'payment_exceeds_balance', and 'debt_not_owned') that leak existence, status, and balance thresholds; (2) As A, insert payment P1 (amount = 200000) on D_active (balance becomes 800000), then call public.restore_rows('debt_payments', '[{"id":"<P1>","debt_id":"<D_active>","amount":200000,"date":"2026-11-08"}]'::jsonb) and verify it returns {restored: 0, skipped: 1} while D_active.balance drops to 600000.
- **Deployment (Owner-Observed Read-Only):** Against a disposable staging Supabase project (never production), test with two dummy accounts A and B whether POST /rest/v1/debt_payments returns raw Postgres exception strings ('debt_closed', 'payment_exceeds_balance', 'debt_not_owned') in the HTTP error JSON, and verify POST /rest/v1/rpc/restore_rows returns the same errors in first_error and double-decrements D_active.balance on duplicate-id ON CONFLICT DO NOTHING calls.

---

<a id="lead-7"></a>

### 7. Unvalidated profiles.notif_prefs JSONB Allows Any User to Abort Hourly planning_reminders and price_alerts Cron for All Tenants

- **Fingerprint:** `postgres/tables-rls/notif-prefs-unvalidated-planning-reminders-dos`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
public.profiles.notif_prefs is granted for direct authenticated client UPDATE without schema/type validation (unlike public.profiles.timezone, which is sanitized by profiles_check_timezone), and public.planning_reminders(timestamptz) casts (l.notif_prefs ->> 'bill_due')::boolean without JSON type guarding or per-row error isolation across all tenants.

**Description:**  
Any authenticated user can update their own public.profiles.notif_prefs column via PostgREST to set the 'bill_due' key to a non-boolean JSON value not accepted by PostgreSQL boolean parsing (such as {"bill_due": "invalid"}, {"bill_due": 2}, or {"bill_due": {}}) and insert an unpaid bill due today or in 3 days in their local timezone. Because profiles.notif_prefs has no CHECK constraint or sanitizing trigger across any of the 33 migrations, the hourly SECURITY DEFINER function public.planning_reminders() executes an unguarded cast coalesce((l.notif_prefs ->> 'bill_due')::boolean, true) across all tenants' due bills inside a single transaction, raising SQLSTATE 22P02, rolling back all tenants' subscription updates and reminders, and causing supabase/functions/planning-reminders/index.ts to throw before invoking public.price_alerts() for any tenant.

**Ordered Trace:**
1. **`entrypoint`** — `supabase/migrations/20261105000002_rls.sql:22` (`public.profiles column-level GRANT and profiles_update RLS`): Authenticated users are granted UPDATE on public.profiles.notif_prefs under policy profiles_update (id = (select auth.uid())), and INSERT on public.bills under bills_all (supabase/migrations/20261108000008_planning.sql:408,425-426).
2. **`propagation`** — `supabase/migrations/20261105000001_schema.sql:21` (`public.profiles.notif_prefs column definition`): notif_prefs jsonb not null is defined without any CHECK constraint or trigger validating JSON structure or field types (contrast profiles_check_timezone at supabase/migrations/20261108000008_planning.sql:52-62); none of the 33 migrations add validation for notif_prefs.
3. **`propagation`** — `supabase/migrations/20261108000009_cron_planning.sql:3` (`pg_cron schedule planning-reminders`): Hourly pg_cron job invokes public.call_edge('planning-reminders') at minute 5 of every hour.
4. **`propagation`** — `supabase/functions/planning-reminders/index.ts:16` (`planning-reminders Edge Function handler`): Edge Function calls db.rpc('planning_reminders') via service_role and throws on error at line 17 before calling db.rpc('price_alerts') at line 19.
5. **`sink`** — `supabase/migrations/20261108000008_planning.sql:357` (`public.planning_reminders(timestamptz)`): Unguarded cast coalesce((l.notif_prefs ->> 'bill_due')::boolean, true) raises SQLSTATE 22P02 when evaluated on a non-boolean bill_due value such as "invalid", rolling back the entire transaction across all tenants and aborting planning-reminders before price_alerts() runs.

**Verified Source Evidence:**
- `supabase/migrations/20261105000001_schema.sql:21` — profiles.notif_prefs is defined as jsonb not null without any CHECK constraint.
- `supabase/migrations/20261105000002_rls.sql:22` — grant update (..., notif_prefs, ...) on public.profiles to authenticated permits any authenticated user to write arbitrary JSONB values to notif_prefs under policy profiles_update (lines 25-26).
- `supabase/migrations/20261108000008_planning.sql:55` — profiles_check_timezone() explicitly states that an invalid user-controlled profile value breaks the reminder cron for all tenants, establishing the intended cross-tenant availability boundary that notif_prefs omits.
- `supabase/migrations/20261108000008_planning.sql:357` — planning_reminders() executes coalesce((l.notif_prefs ->> 'bill_due')::boolean, true) across all tenants' due bills inside a single unisolated transaction.
- `supabase/migrations/20261108000008_planning.sql:408` — Authenticated users are granted INSERT on public.bills (up to 3 active bills/debts on Free plan), allowing any user to satisfy due_date - l.today in (0, 3) when local hour >= 7.
- `supabase/functions/planning-reminders/index.ts:17` — Edge Function throws on any planning_reminders error before invoking db.rpc('price_alerts') on line 19.

**Exact Blockers:**
- Host OS enforces apparmor_restrict_unprivileged_userns=1 and lacks bwrap, firejail, nsjail, Docker, and deno, blocking local execution of PGlite/Postgres (scripts/db-test.mjs) and Deno Edge Functions to observe SQLSTATE 22P02 and the resulting cross-tenant transaction rollback.

**Validation Plan:**
- **Local (Bounded Fixture):** Inside an isolated sandbox with Node/PGlite or Postgres 17 (having verified all 33 migrations in source), run a dummy-tenant fixture where dummy user A updates profiles.notif_prefs = '{"bill_due":"invalid"}'::jsonb and inserts an unpaid bill due on A's local date, while dummy user B has a due bill, an active subscription renewing in 2 days, an overdue active subscription, and a triggered asset_price_alerts row. Execute select public.planning_reminders(p_now) when local hour >= 7 for A and B, and verify it raises SQLSTATE 22P02 (invalid input syntax for type boolean), rolls back B's subscription next_renewal advancement, inserts zero reminders for B, and causes planning-reminders/index.ts to throw before calling price_alerts().

---

## Billing, Entitlements, Webhooks & Payment Environment Parity

<a id="lead-8"></a>

### 8. Per-isolate in-memory rate limit bypass and unpruned Map in entitlement-sync against shared RevenueCat API and database sync RPCs

- **Fingerprint:** `arshif:resource-limits:entitlement-sync-per-isolate-rate-limit-bypass`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
entitlement-sync enforces its user rate limit in an unpruned per-isolate Map (lastCalls) rather than Postgres (unlike ai_job_start and place_lookup_start), allowing cross-isolate bypass against the shared RC_SECRET_KEY RevenueCat API and database sync RPCs, while its hourly cron branch processes up to 200 unordered expired profiles and 100 stuck orders sequentially.

**Description:**  
User-triggered POST /functions/v1/entitlement-sync guards RevenueCat REST v2 API calls using a module-level Map (lastCalls) capped at SYNC_LIMIT_PER_MINUTE = 6 per Edge Function isolate, with no Postgres-backed rate limit, no daily cap, and no eviction of expired user.id entries. Across multiple Edge Function isolates or worker restarts, an authenticated user (public signup is enabled) can bypass the 6/minute cap to repeatedly invoke syncPlan (plan_sync_ticket RPC, uncached RevenueCat GET /v2/projects/{id}/customers/{uid}/active_entitlements without timeout under shared project-wide RC_SECRET_KEY, conditional orders read when active, and plan_sync_apply RPC). While effective_plan() in later migration 20261121000022_audit_fixes.sql prevents expired profiles from retaining server-enforced Premium quotas, exhausting RevenueCat API rate limits on RC_SECRET_KEY affects grantOrder in xendit-webhook and paddle-webhook (marking paid orders with grant_error), causes 502s in revenuecat-webhook, and can starve the sequential 100-order grantOrder retry loop that runs after the sequential 200-profile expired syncPlan loop in hourly cron entitlement-sync.

**Ordered Trace:**
1. **`entrypoint`** — `supabase/functions/entitlement-sync/index.ts:36` (`POST /functions/v1/entitlement-sync`): Authenticated user invokes entitlement-sync without x-cron-secret after requireUser(req) verifies the Bearer JWT.
2. **`propagation`** — `supabase/functions/entitlement-sync/index.ts:39` (`lastCalls check`): Checks and mutates isolate-local lastCalls Map (never pruning inactive user.id keys and not shared across Edge isolates or worker restarts).
3. **`propagation`** — `supabase/functions/entitlement-sync/index.ts:47` (`syncPlan call`): When RC_SECRET_KEY, RC_PROJECT_ID, and RC_ENTITLEMENT_ID are configured (line 43), calls syncPlan(db, user.id).
4. **`propagation`** — `supabase/functions/_shared/entitlement.ts:56` (`syncPlan`): Acquires a sequence ticket via plan_sync_ticket RPC (line 54), calls premiumUntil(db, userId) (line 56), conditionally reads orders (lines 61-74), and executes plan_sync_apply RPC (line 76).
5. **`sink`** — `supabase/functions/_shared/revenuecat.ts:20` (`premiumUntil`): Issues an uncached GET /v2/projects/{id}/customers/{uid}/active_entitlements?limit=100 request without AbortSignal.timeout using project-wide RC_SECRET_KEY shared with webhook and admin entitlement flows.

**Verified Source Evidence:**
- `supabase/functions/entitlement-sync/index.ts:12` — SYNC_LIMIT_PER_MINUTE = 6 and lastCalls = new Map<string, number[]>() (line 13) reside solely in per-isolate module memory and never delete stale user keys (lines 39-41).
- `supabase/functions/entitlement-sync/index.ts:20` — Hourly cron path (20261106000006_cron_monetization.sql:8) selects up to 200 expired profiles without ORDER BY and awaits syncPlan sequentially (line 21) before querying and sequentially awaiting grantOrder on up to 100 stuck paid orders (lines 22-32).
- `supabase/functions/_shared/entitlement.ts:51` — syncPlan invokes plan_sync_ticket (line 54), RevenueCat premiumUntil (line 56), conditional orders lookup when active (lines 61-74), and plan_sync_apply (line 76); grantOrder (lines 113-146) records failures in orders.grant_error for cron retry.
- `supabase/functions/_shared/revenuecat.ts:20` — Calls RevenueCat REST v2 without a request timeout using project-wide RC_SECRET_KEY (lines 6-11) shared across entitlement-sync, revenuecat-webhook, xendit-webhook, paddle-webhook, and admin-user.
- `supabase/config.toml:473` — entitlement-sync has verify_jwt = false with no gateway rate-limit parameters configured, while enable_signup = true (line 177) allows account creation.
- `supabase/migrations/20261116000019_billing_guards.sql:12` — AI endpoints use Postgres advisory-locked ai_job_start (and 20261121000023_tx_place.sql:29 uses place_lookup_start) instead of isolate memory; 20261121000022_audit_fixes.sql:5 adds effective_plan() for quota enforcement so expired profiles only affect UI display and cron retry starvation.

**Exact Blockers:**
- Host OS sandbox restrictions (apparmor_restrict_unprivileged_userns=1 without bwrap, firejail, nsjail, deno, or Docker) prevent executing Deno Edge Function workers locally.
- Whether RC_SECRET_KEY, RC_PROJECT_ID, and RC_ENTITLEMENT_ID are configured in production Edge secrets (entitlement-sync/index.ts:43 short-circuits to a DB read when unset), deployed Edge isolate scaling/routing topology, and any upstream API-gateway/CDN rate limits are outside the repository.
- RevenueCat REST v2 rate-limit quotas for RC_SECRET_KEY and whether GET /active_entitlements shares a project-wide quota bucket with POST grant_entitlement and revoke_granted_entitlement used by payment webhooks and admin-user are external to the repository.

**Validation Plan:**
- **Local (Bounded Fixture):** In an isolated Deno test harness with stubbed Supabase RPCs/tables and a mock RevenueCat HTTP server, instantiate two separate worker isolates of supabase/functions/entitlement-sync/index.ts with RC_SECRET_KEY, RC_PROJECT_ID, and RC_ENTITLEMENT_ID set to dummy values, and verify each isolate independently permits 6 requests within 60 seconds (12 total calls to GET /active_entitlements) for the same dummy user ID before returning HTTP 429.
- **Deployment (Owner-Observed Read-Only):** Verify in Supabase Edge secrets whether RC_SECRET_KEY, RC_PROJECT_ID, and RC_ENTITLEMENT_ID are configured; check Edge Function worker concurrency/isolate routing and upstream gateway rate limits on POST /functions/v1/entitlement-sync; inspect RevenueCat REST v2 rate-limit headroom and shared bucket impact on grant_entitlement/revoke_granted_entitlement; and measure cron execution duration under expired-profile/stuck-order backlog.

---

<a id="lead-9"></a>

### 9. Non-atomic RevenueCat HTTP calls outside Postgres advisory locks allow refunded orders to retain or regain Premium entitlement

- **Fingerprint:** `billing/entitlement-grant-refund-race`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
grantOrder and refundOrder perform external RevenueCat reads and mutations outside transaction-scoped Postgres advisory locks and without status-conditional revalidation, order-scoped grant fencing/outbox state, or RevenueCat idempotency tokens, allowing DB order transitions and RevenueCat grant/revoke calls to interleave out of order.

**Description:**  
In grantOrder and refundOrder, Postgres advisory locks (pg_advisory_xact_lock(hashtext('grant:' || o.user_id::text))) are held only for the single-transaction duration of the reserve_grant and refund_shift RPCs and released before external HTTP calls to RevenueCat REST API v2. Additionally, grantOrder reads RevenueCat premiumUntil before acquiring any lock, reserve_grant does not re-verify o.status = 'paid' after acquiring the advisory lock, and grantOrder updates orders.grant_error = null (and catches errors into grant_error) without filtering .eq('status', 'paid'). Because payment callbacks (xendit-webhook, paddle-webhook), hourly entitlement-sync retries, and admin grants use distinct webhook event keys or no event locks relative to refund/revoke paths, concurrent grantOrder and refundOrder executions can interleave: a stale grantOrder can post grant_entitlement to RevenueCat after refundOrder has already invoked revokeGrants and synced profiles.plan = 'free', clear grant_error = 'refund_applied', and then invoke syncPlan (plan_sync_apply) with a newer ticket to persist profiles.plan = 'premium' and future profiles.premium_until for a refunded order; or a new order o2 can read pre-refund RevenueCat expiration and stack onto a refunded period.

**Ordered Trace:**
1. **`entrypoint`** — `supabase/functions/xendit-webhook/index.ts:63` (`xendit-webhook payment handler`): Payment settlement callback transitions order to paid and invokes grantOrder (same pattern in paddle-webhook/index.ts:75, admin-grant.ts:19, and hourly entitlement-sync/index.ts:32 retries for paid orders with grant_error).
2. **`propagation`** — `supabase/functions/_shared/entitlement.ts:118` (`grantOrder`): Reads current expiration from RevenueCat via premiumUntil before acquiring any Postgres lock, which becomes stale if a concurrent refund revokes an existing entitlement.
3. **`propagation`** — `supabase/migrations/20261106000005_monetization.sql:217` (`reserve_grant`): Acquires pg_advisory_xact_lock('grant:' || user_id), computes granted_from/granted_until from p_current and paid orders, and commits upon RPC return, releasing the lock prior to RevenueCat HTTP mutations.
4. **`propagation`** — `supabase/functions/_shared/entitlement.ts:155` (`refundOrder`): Concurrent refund path (xendit-webhook/index.ts:36, paddle-webhook/index.ts:52, or admin-user/index.ts:39) transitions the order to refunded, calls refund_shift (releasing its lock on commit), calls revokeGrants on RevenueCat, and calls syncPlan to set profiles.plan = 'free'.
5. **`propagation`** — `supabase/functions/_shared/revenuecat.ts:33` (`grantPremium`): Invoked by grantOrder (entitlement.ts:128) without re-checking order status = 'paid'; posts grant_entitlement to RevenueCat after revokeGrants has run, while entitlement.ts:129 clears grant_error = null without .eq('status', 'paid').
6. **`sink`** — `supabase/migrations/20261116000019_billing_guards.sql:51` (`plan_sync_apply`): Called by syncPlan (entitlement.ts:76 via line 131) with a newer plan_sync_seq ticket after the stale RevenueCat grant, treating RevenueCat as authoritative and writing profiles.plan = 'premium' and future premium_until for the refunded order.

**Verified Source Evidence:**
- `supabase/functions/xendit-webhook/index.ts:36` — refund.succeeded handler invokes refundOrder under event ID 'refund:' || data.id, independent of the payment handler's event ID (line 46) that invokes grantOrder at line 63.
- `supabase/functions/paddle-webhook/index.ts:52` — Approved full refund/chargeback handler invokes refundOrder under the adjustment event_id, independent of transaction.paid/completed invoking grantOrder at line 75.
- `supabase/functions/entitlement-sync/index.ts:32` — Hourly cron loop iterates paid orders with non-null grant_error (excluding partial_refund) and invokes grantOrder without event locking against concurrent refunds.
- `supabase/functions/_shared/entitlement.ts:118` — grantOrder executes premiumUntil (line 118), reserve_grant RPC (line 125), grantPremium (line 128), unguarded orders.update({ grant_error: null }).eq('id', order.id) (line 129), and syncPlan (line 131) as separate unlocked steps.
- `supabase/functions/_shared/entitlement.ts:155` — refundOrder executes transitionOrder (line 156), refund_shift RPC (line 161), revokeGrants (line 163), grantPremium (line 164), and syncPlan (line 165) as separate unlocked steps.
- `supabase/functions/_shared/revenuecat.ts:33` — grantPremium sends { entitlement_id, expires_at } to RevenueCat /actions/grant_entitlement with no order reference, idempotency key, or epoch check.
- `supabase/migrations/20261106000005_monetization.sql:217` — reserve_grant releases pg_advisory_xact_lock when the RPC commits before RevenueCat HTTP calls, and re-reads o at line 219 without re-checking o.status = 'paid' inside the lock.
- `supabase/migrations/20261116000019_billing_guards.sql:51` — plan_sync_apply orders profile updates by plan_sync_seq ticket but treats RevenueCat active_entitlements as authoritative, persisting any post-revoke grant into profiles.plan and profiles.premium_until.
- `supabase/migrations/20261121000022_audit_fixes.sql:106` — Updated refund_shift retains transaction-scoped pg_advisory_xact_lock released before revokeGrants, and effective_plan (line 7) only downgrades premium when premium_until <= now().

**Exact Blockers:**
- Host kernel enforces apparmor_restrict_unprivileged_userns=1 and lacks OS sandbox isolation controls (bwrap/firejail/nsjail/Docker) and deno runtime, preventing execution of Edge Functions against a local Postgres instance and mock RevenueCat HTTP server.
- Live RevenueCat REST v2 grant_entitlement / revoke_granted_entitlement and Xendit/Paddle webhook delivery behavior under concurrent payment settlement/retry and refund callbacks cannot be observed without external network access or staging sandbox credentials.

**Validation Plan:**
- **Local (Bounded Fixture):** Run a sandboxed Deno Edge Function + local Postgres/PGlite harness with a loopback HTTP mock for RevenueCat v2 that injects a 200ms delay before responding to POST /v2/projects/{project}/customers/{user}/actions/grant_entitlement inside grantOrder(o1); concurrently execute refundOrder(o1.id) to completion during the delay; verify whether orders.status = 'refunded' and orders.grant_error = null while the RevenueCat mock active entitlement and profiles.plan/premium_until remain 'premium' with a future expiration.
- **Deployment (Owner-Observed Read-Only):** Owner-observed non-destructive staging check using Xendit/Paddle test mode and RevenueCat sandbox on a dedicated test account: trigger payment completion and an immediate refund (or delayed grant retry racing a refund event), then compare orders (status, granted_until, grant_error) and profiles (plan, premium_until) against RevenueCat customer active_entitlements, revoking any leftover test entitlement afterwards.

---

<a id="lead-10"></a>

### 10. refund_shift reads order state before acquiring pg_advisory_xact_lock, allowing concurrent refund calls to double-shift stacked paid orders

- **Fingerprint:** `billing/refund-shift-prelock-stale-read`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
refund_shift evaluates its idempotency guard (o.grant_error is distinct from 'refund_applied') against a PL/pgSQL record variable populated before pg_advisory_xact_lock without re-reading public.orders after lock acquisition, while refundOrder does not gate refund_shift on transitionOrder performing the status transition and handleEventOnce permits concurrent execution across distinct event_ids or expired (>5 minute) claims.

**Description:**  
In supabase/migrations/20261121000022_audit_fixes.sql, refund_shift(p_order) populates local record o with SELECT * INTO o FROM public.orders at line 104 before acquiring pg_advisory_xact_lock(hashtext('grant:' || o.user_id::text)) at line 106 and never re-selects o after acquiring the lock (unlike reserve_grant in 20261106000005_monetization.sql line 219). Meanwhile, refundOrder in supabase/functions/_shared/entitlement.ts discards the return value of transitionOrder(db, orderId, 'refunded') at line 156 and calls refund_shift whenever order.status === 'refunded' and order.user_id is non-null at lines 160-161. Under concurrent refund invocations (such as Paddle delivering adjustment.created and adjustment.updated with status='approved' and distinct event_ids, a >5-minute stalled webhook_claim reclaimed in handleEventOnce, or concurrent admin-user revoke requests), a second transaction running in Postgres READ COMMITTED reads the pre-commit orders row (o.grant_error != 'refund_applied') at line 104 before waiting on the advisory lock at line 106. After the first transaction commits grant_error = 'refund_applied' and shifts subsequent paid orders backward by v_len, the waking second transaction evaluates line 107 against its stale local record o and executes the backward shift UPDATE at lines 109-110 again against any remaining paid order still having granted_from >= o.granted_until (such as a 3rd stacked order o3 where o2's duration >= v_len, or a post-gap order o2 after a store subscription), subtracting v_len a second time and returning a corrupted shorter v_end that refundOrder writes to RevenueCat and profiles.premium_until.

**Ordered Trace:**
1. **`entrypoint`** — `supabase/functions/paddle-webhook/index.ts:28` (`serve`): Authenticated Paddle webhook POST handler enters handleEventOnce(db, 'paddle', event.event_id) at line 42, which deduplicates only per (provider, event_id) within a 5-minute claim window and permits concurrent execution for distinct event_ids (e.g., adjustment.created and adjustment.updated) or reclaimed >5-minute stalled claims.
2. **`propagation`** — `supabase/functions/paddle-webhook/index.ts:52` (`serve`): Inside the adjustment.* handler (lines 43-45, non-partial approved refund or chargeback), invokes refundOrder(db, order.id) concurrently for the same order_id (concurrent xendit-webhook refund.succeeded at line 36 or admin-user revoke at line 39 can likewise invoke refundOrder concurrently).
3. **`propagation`** — `supabase/functions/_shared/entitlement.ts:156` (`refundOrder`): Discards the return value of transitionOrder(db, orderId, 'refunded') and at lines 160-161 calls db.rpc('refund_shift', { p_order: orderId }) whenever the order's current status is 'refunded' and user_id is non-null.
4. **`propagation`** — `supabase/migrations/20261121000022_audit_fixes.sql:104` (`refund_shift`): Reads public.orders into local variable o (with grant_error != 'refund_applied') before calling pg_advisory_xact_lock at line 106 and never re-reads o after acquiring the lock, so a second concurrent transaction blocked at line 106 retains stale o after the first commits.
5. **`sink`** — `supabase/migrations/20261121000022_audit_fixes.sql:109` (`refund_shift`): Second transaction passes the stale o.grant_error check at line 107 and re-executes the backward shift UPDATE (line 110: granted_from >= o.granted_until), shifting eligible remaining paid orders (e.g., 3rd stacked order o3 or post-gap order o2) backward by v_len a second time and returning a doubly reduced v_end that refundOrder writes to RevenueCat and profiles.premium_until at entitlement.ts lines 164-165.

**Verified Source Evidence:**
- `supabase/migrations/20261121000022_audit_fixes.sql:104` — select * into o runs at line 104 prior to pg_advisory_xact_lock at line 106, and o is not re-selected before the o.grant_error is distinct from 'refund_applied' check at line 107; none of the subsequent migrations (20261121000023 through 20261122000029) modify refund_shift.
- `supabase/migrations/20261106000005_monetization.sql:219` — Contrast with reserve_grant, which explicitly re-selects o after pg_advisory_xact_lock(hashtext('grant:' || o.user_id::text)) at line 217 to avoid stale local state; original refund_shift at line 247 also lacked a post-lock re-select.
- `supabase/functions/_shared/entitlement.ts:156` — refundOrder ignores transitionOrder's return value and invokes refund_shift whenever orders.status = 'refunded' and user_id is non-null (lines 160-161), then passes the returned end timestamp to grantPremium and syncPlan (lines 163-165).
- `supabase/functions/paddle-webhook/index.ts:43` — paddle-webhook invokes refundOrder at line 52 for any adjustment.* event with action in ('refund', 'chargeback'), status = 'approved', and non-partial type, keyed in webhook_claim only by (provider, event_id); docs/fase3-pembayaran.md lines 91-92 explicitly subscribe both adjustment.created and adjustment.updated.
- `supabase/migrations/20261116000019_billing_guards.sql:75` — webhook_claim allows re-claiming an unprocessed webhook_events row after 5 minutes (processed_at is null and claimed_at < now() - interval '5 minutes'), permitting overlapping execution even for a single event_id if an earlier invocation stalls past 5 minutes before refund_shift commits (whereas failing webhook_done at entitlement.ts line 187 runs after work() finishes and causes sequential re-execution).

**Exact Blockers:**
- Execution is disabled in this source-only audit sandbox, and the repository's local DB test harness (scripts/db-test.mjs) uses single-connection @electric-sql/pglite rather than a multi-session Postgres and Deno runtime capable of exercising concurrent blocking transactions on pg_advisory_xact_lock.
- Live Paddle/Xendit webhook concurrency (e.g., whether Paddle Billing delivers adjustment.created and adjustment.updated concurrently with status='approved' in sandbox or production once deployed) cannot be observed from source-only offline review.

**Validation Plan:**
- **Local (Bounded Fixture):** In a sandboxed two-session local Postgres instance initialized with supabase/tests/supabase-stub.sql and all 28 non-cron migrations through 20261122000029_card_details.sql (skipping *cron* migrations and stripping CREATE EXTENSION lines as in scripts/db-test.mjs lines 14-16), insert a dummy user into auth.users, insert three paid 'monthly' orders (o1, o2, o3) stacked sequentially via reserve_grant, update o1.status = 'refunded', in session 1 run BEGIN; SELECT public.refund_shift(o1); and leave tx1 uncommitted (retaining pg_advisory_xact_lock acquired at line 106), in session 2 run BEGIN; SELECT public.refund_shift(o1); so line 104 reads pre-commit o and blocks at line 106, COMMIT tx1 then COMMIT tx2, and verify o3.granted_from/granted_until shifted backward twice (by ~2 * v_len) to overlap o2 and reduce returned v_end.
- **Deployment (Owner-Observed Read-Only):** In Paddle sandbox or once deployed (docs/fase3-pembayaran.md notes billing is not yet deployed), have the owner inspect webhook destination config and webhook/admin-user request logs to observe whether adjustment.created and adjustment.updated arrive overlapping with status='approved' (distinct event_ids), whether >5m stalled webhook claims or concurrent admin-user revoke calls overlap on the same order_id, and audit public.orders for multi-order accounts with grant_error = 'refund_applied' whose remaining paid orders show overlapping granted_from..granted_until ranges.

---

<a id="lead-11"></a>

### 11. Silent sandbox fallback and missing payment-environment parity checks across checkout and webhooks

- **Fingerprint:** `deploy/paddle-env-sandbox-default-drift`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
Client and server Paddle environment settings fail open to 'sandbox' in src/config/public.ts:20 and supabase/functions/_shared/env.ts:51-52, checkout-create/index.ts:26-29 omits PADDLE_ENV, RC_PROJECT_ID/RC_ENTITLEMENT_ID, and credential-vs-APP_URL parity checks, and paddle-webhook/index.ts:30-75 plus xendit-webhook/index.ts:18-63 transition matching paid orders and grant real Premium entitlements after verifying configured webhook secrets and order/price/amount constraints without checking deployment environment mode.

**Description:**  
Both client and server Paddle configurations default PADDLE_ENV to 'sandbox' when EXPO_PUBLIC_PADDLE_ENV or PADDLE_ENV is unset or anything other than 'production' (src/config/public.ts:20, src/lib/paddle.web.ts:17, supabase/functions/_shared/env.ts:51-52). In supabase/functions/checkout-create/index.ts:26-29, the readiness check does not require PADDLE_ENV, checks only RC_SECRET_KEY while omitting RC_PROJECT_ID and RC_ENTITLEMENT_ID required by revenueCatReady() in supabase/functions/_shared/entitlement.ts:27 (causing silent fallback to DB-only grants and RevenueCat desync if partially configured), and enforces no parity guard rejecting test/sandbox payment credentials (such as xnd_development_... Xendit keys on https://api.xendit.co/v2/invoices or Paddle sandbox credentials) when paired with a production APP_URL. Furthermore, neither supabase/functions/paddle-webhook/index.ts:30-75 nor supabase/functions/xendit-webhook/index.ts:18-63 checks production vs sandbox mode before transitioning orders to 'paid' and calling grantOrder(). Note that if production Paddle keys (pdl_live_...) are deployed with PADDLE_ENV omitted, Paddle's sandbox API rejects the request (502 provider_error); however, because the repo hardcodes a single Supabase project (gyxtdpmruuhhkprlhlrk) with live Vercel web deployment APP_URL=https://arshifstudio.vercel.app (docs/fase8-admin.md:4-11) and public signup (supabase/config.toml:177, src/app/(auth)/masuk.tsx), if sandbox/test payment secrets are active on that live project (as described for initial deployment in docs/fase3-pembayaran.md:3-4, 48-52, 97-101), any authenticated Free user can complete a test/sandbox checkout and receive real Premium entitlements and higher operator-billed AI quotas without real payment. All 33 Postgres migrations up through 20261122000029_card_details.sql were checked and add no sandbox-vs-live guard. Live Supabase Edge Function secrets and Vercel environment variables reside outside the repository.

**Ordered Trace:**
1. **`entrypoint`** — `src/app/premium/index.tsx:112` (`PremiumScreen.pay`): Authenticated Free user initiates web checkout on /premium (calling createCheckout at line 116 and redirecting to Xendit at line 120 or opening Paddle.js overlay via openPaddleCheckout at line 125; public signup is enabled via src/app/(auth)/masuk.tsx and supabase/config.toml:177).
2. **`propagation`** — `supabase/functions/checkout-create/index.ts:26` (`checkout-create readiness gate`): Readiness check configured(...needed) (lines 26-29) requires only XENDIT_SECRET_KEY/XENDIT_CALLBACK_TOKEN/APP_URL/RC_SECRET_KEY or PADDLE_API_KEY/PADDLE_WEBHOOK_SECRET/PADDLE_PRICE_<PERIOD>/RC_SECRET_KEY, omitting PADDLE_ENV, RC_PROJECT_ID, RC_ENTITLEMENT_ID, and any guard rejecting test/sandbox credentials alongside a production APP_URL() (line 56).
3. **`propagation`** — `supabase/functions/_shared/env.ts:51` (`PADDLE_API_BASE and XENDIT_SECRET_KEY`): Server PADDLE_API_BASE() silently falls back to 'https://sandbox-api.paddle.com' whenever Deno.env.get('PADDLE_ENV') !== 'production' (lines 51-52, matching PADDLE_ENV defaulting to 'sandbox' in src/config/public.ts:20 and src/lib/paddle.web.ts:17), while XENDIT_SECRET_KEY() (line 44) accepts xnd_development_... test keys against the shared https://api.xendit.co/v2/invoices endpoint (supabase/functions/_shared/xendit.ts:19).
4. **`propagation`** — `supabase/functions/paddle-webhook/index.ts:74` (`paddle-webhook fulfillment`): After verifying PADDLE_WEBHOOK_SECRET (lines 30-33), order/provider_ref binding (lines 58-63), and price/total checks (lines 67-73), paddle-webhook transitions the order to 'paid' (line 74) and invokes grantOrder(db, updated) (line 75) without verifying production vs sandbox mode; xendit-webhook/index.ts:18-19,48-63 likewise verifies XENDIT_CALLBACK_TOKEN, order/provider_ref binding, and currency/amount match before transitioning orders to 'paid' and calling grantOrder without checking live vs test mode.
5. **`sink`** — `supabase/functions/_shared/entitlement.ts:131` (`grantOrder -> syncPlan`): grantOrder (lines 113-147) reserves duration via reserve_grant, calls rc.grantPremium (line 128) when revenueCatReady() is true (all three RC_* vars at line 27, otherwise skipping RevenueCat and using local orders), and calls syncPlan (line 131) -> plan_sync_apply to set profiles.plan = 'premium', unlocking live Premium quotas and features.

**Verified Source Evidence:**
- `src/config/public.ts:20` — PADDLE_ENV defaults to 'sandbox' unless process.env.EXPO_PUBLIC_PADDLE_ENV === 'production', and PADDLE_CLIENT_TOKEN defaults to '' at line 19.
- `src/lib/paddle.web.ts:17` — Calls p.Environment.set('sandbox') when PADDLE_ENV === 'sandbox' before initializing Paddle.js with PADDLE_CLIENT_TOKEN (line 18).
- `supabase/functions/_shared/env.ts:44` — XENDIT_SECRET_KEY() reads Deno.env.get('XENDIT_SECRET_KEY') without prefix checks (commented for xnd_development_... test keys at line 43).
- `supabase/functions/_shared/env.ts:51` — PADDLE_API_BASE() returns 'https://sandbox-api.paddle.com' whenever Deno.env.get('PADDLE_ENV') !== 'production' (lines 51-52).
- `supabase/functions/checkout-create/index.ts:26` — needed array (lines 26-29) omits PADDLE_ENV, RC_PROJECT_ID, and RC_ENTITLEMENT_ID, and performs no test-key or sandbox parity check against APP_URL().
- `supabase/functions/_shared/entitlement.ts:27` — revenueCatReady() requires all three of RC_SECRET_KEY, RC_PROJECT_ID, and RC_ENTITLEMENT_ID, diverging from checkout-create's RC_SECRET_KEY-only check.
- `supabase/functions/paddle-webhook/index.ts:30` — Checks configured('PADDLE_WEBHOOK_SECRET') and HMAC signature (lines 30-33) plus order/price/total validation (lines 58-73) with no production-vs-sandbox mode check before transitioning orders to 'paid' and calling grantOrder (lines 74-75).
- `supabase/functions/xendit-webhook/index.ts:18` — Checks configured('XENDIT_CALLBACK_TOKEN') and static callback token (lines 18-19) plus order/currency/amount validation (lines 41-61) with no live-vs-test mode check before transitioning orders to 'paid' and calling grantOrder (lines 62-63).
- `docs/fase8-admin.md:11` — Documents that APP_URL is already set to live production URL https://arshifstudio.vercel.app on Supabase project gyxtdpmruuhhkprlhlrk (where checkout returned 503 not_configured as of 2026-11-06 per line 86).
- `docs/fase3-pembayaran.md:4` — Documents deploying Xendit test mode (xnd_development_...) and Paddle sandbox against the single project gyxtdpmruuhhkprlhlrk webhook endpoints (lines 48-52, 97-101).

**Exact Blockers:**
- Host Linux kernel enforces apparmor_restrict_unprivileged_userns=1 and lacks bwrap, firejail, nsjail, deno, and Docker, blocking bounded local Edge Function fixture execution.
- Live Supabase Edge Function secrets (PADDLE_ENV, PADDLE_API_KEY, PADDLE_WEBHOOK_SECRET, PADDLE_PRICE_MONTHLY, PADDLE_PRICE_YEARLY, XENDIT_SECRET_KEY, XENDIT_CALLBACK_TOKEN, APP_URL, RC_SECRET_KEY, RC_PROJECT_ID, RC_ENTITLEMENT_ID) on project gyxtdpmruuhhkprlhlrk and Vercel build environment variables (EXPO_PUBLIC_PADDLE_ENV, EXPO_PUBLIC_PADDLE_CLIENT_TOKEN) on arshifstudio are outside the repository.

**Validation Plan:**
- **Local (Bounded Fixture):** In an isolated Deno test harness with dummy local Postgres/Supabase and mock Paddle/Xendit HTTP stubs, test checkout-create and paddle-webhook/xendit-webhook using (a) PADDLE_ENV unset, dummy sandbox Paddle secrets, and APP_URL=https://example.test, (b) XENDIT_SECRET_KEY='xnd_development_dummy' with APP_URL=https://example.test, and (c) RC_SECRET_KEY set without RC_PROJECT_ID/RC_ENTITLEMENT_ID; verify whether checkout-create returns 200 instead of failing closed and whether signed/token-verified webhooks invoke grantOrder or desync RevenueCat.
- **Deployment (Owner-Observed Read-Only):** Owner should inspect deployed Supabase secret names (`npx supabase secrets list` without printing values) and their Xendit/Paddle provisioning records on project gyxtdpmruuhhkprlhlrk, plus Vercel Production/Preview environment variables on arshifstudio, to observe whether payment secrets remain unset (503 not_configured), whether test/sandbox keys (xnd_development_..., pdl_sdbx_..., test_... client tokens) are active on the publicly reachable deployment, whether PADDLE_ENV and EXPO_PUBLIC_PADDLE_ENV match the active Paddle key mode, and whether RC_PROJECT_ID and RC_ENTITLEMENT_ID are configured whenever RC_SECRET_KEY is set.

---

<a id="lead-12"></a>

### 12. Out-of-order refund webhooks for pending/expired/failed orders are silently ignored and marked processed, allowing subsequent payment webhook to grant Premium

- **Fingerprint:** `webhooks/out-of-order-refund-acked`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
nextStatus rejects non-'paid' -> 'refunded' transitions with null, refundOrder exits silently without error or refund tombstone when order.status !== 'refunded', and handleEventOnce commits webhook_done (processed_at = now()) on HTTP 200 OK while nextStatus still allows 'pending'/'expired'/'failed' -> 'paid'.

**Description:**  
When Xendit (refund.succeeded) or Paddle (adjustment.created/adjustment.updated with approved full refund/chargeback) delivers a refund webhook while the order row in public.orders is still in 'pending', 'expired', or 'failed' state—for example, because the initial payment webhook experienced a transient failure/delay awaiting provider retry, because a Paddle payment failed first (transaction.payment_failed -> 'failed') and was later retried, or because the 10-minute orders-expire cron marked the order 'expired' after 24h (note Paddle orders also inherit the 24h expires_at default)—checkout-create has already stored provider_ref on the order, so the refund webhook locates the order and calls refundOrder(db, order.id). refundOrder calls transitionOrder(db, orderId, 'refunded'), which calls nextStatus(order.status, 'refunded'). Because nextStatus only permits 'paid' -> 'refunded' and returns null for 'pending', 'expired', and 'failed', transitionOrder returns null without updating orders. refundOrder then reads order.status !== 'refunded' and returns cleanly without throwing or recording a refund tombstone. Both webhooks respond HTTP 200 OK, and handleEventOnce calls webhook_done to set webhook_events.processed_at = now(), permanently suppressing refund retries via webhook_claim. When the delayed or retried payment webhook arrives later, nextStatus transitions 'pending'/'expired'/'failed' -> 'paid' and grantOrder issues Premium entitlement for an already-refunded order.

**Ordered Trace:**
1. **`entrypoint`** — `supabase/functions/xendit-webhook/index.ts:23` (`xendit-webhook POST`): After verifyStaticToken succeeds at line 19, accepts refund.succeeded with data.id and data.invoice_id inside handleEventOnce (mirroring authenticated adjustment.* at supabase/functions/paddle-webhook/index.ts:43-45).
2. **`propagation`** — `supabase/functions/xendit-webhook/index.ts:36` (`xendit-webhook POST`): Locates the order via provider_ref (stored at checkout-create) and for non-partial refunds calls refundOrder(db, order.id), then returns json({ ok: true }) at line 37 (mirroring supabase/functions/paddle-webhook/index.ts:52 and 55).
3. **`propagation`** — `supabase/functions/_shared/entitlement.ts:156` (`refundOrder`): Calls transitionOrder(db, orderId, 'refunded'), which reads the order row and invokes nextStatus(order.status, 'refunded') at line 92.
4. **`propagation`** — `supabase/functions/_shared/billing.ts:32` (`nextStatus`): Returns null whenever current status is 'pending', 'expired', or 'failed' (permitting 'refunded' only from 'paid'), causing transitionOrder at entitlement.ts:93 to return null without modifying orders.
5. **`propagation`** — `supabase/functions/_shared/entitlement.ts:160` (`refundOrder`): Re-reads orders.status at line 157 and returns normally without throwing or recording a refund tombstone when order.status !== 'refunded', returning HTTP 200 OK to handleEventOnce.
6. **`sink`** — `supabase/functions/_shared/entitlement.ts:187` (`handleEventOnce`): Calls webhook_done to set webhook_events.processed_at = now(), permanently rejecting redeliveries of the refund event via webhook_claim while leaving orders transitionable to 'paid' -> grantOrder on subsequent payment webhook delivery.

**Verified Source Evidence:**
- `supabase/functions/_shared/billing.ts:27` — nextStatus permits 'paid' from 'pending', 'failed', or 'expired' (line 27), while 'refunded' (lines 31-32) returns null unless current === 'paid' (explicitly asserted for 'pending' -> 'refunded' in src/__tests__/billing.test.ts:36).
- `supabase/functions/_shared/entitlement.ts:156` — refundOrder invokes transitionOrder(db, orderId, 'refunded') at line 156, silently returns at line 160 if order.status !== 'refunded', and handleEventOnce commits webhook_done at line 187 when work() resolves without error.
- `supabase/functions/xendit-webhook/index.ts:36` — Xendit refund.succeeded queries orders by provider_ref (line 27) and calls refundOrder at line 36 inside handleEventOnce; a later PAID/SETTLED callback calls transitionOrder(..., 'paid') and grantOrder at lines 62-63.
- `supabase/functions/paddle-webhook/index.ts:52` — Paddle approved refund/chargeback adjustment queries orders by provider_ref (line 46) and calls refundOrder at line 52 inside handleEventOnce; a later transaction.completed/paid calls transitionOrder(..., 'paid') and grantOrder at lines 74-75, while transaction.payment_failed sets 'failed' at line 77.
- `supabase/functions/checkout-create/index.ts:58` — Persists provider_ref on the 'pending' order during checkout creation (line 58 for Xendit, line 63 for Paddle where expires_at remains the 24h table default), allowing refund/adjustment webhooks to resolve the order before any payment webhook succeeds.
- `supabase/migrations/20261116000019_billing_guards.sql:70` — webhook_claim (lines 70-77) suppresses reprocessing once webhook_done (lines 79-82) populates processed_at; orders-expire cron in supabase/migrations/20261106000006_cron_monetization.sql:4-5 transitions pending orders past expires_at to 'expired'.

**Exact Blockers:**
- Host Linux kernel enforces apparmor_restrict_unprivileged_userns=1 and lacks OS sandbox controls (bwrap/firejail/nsjail/Docker) and deno runtime to execute the webhook handlers against a local Postgres/PGlite harness.
- External provider webhook delivery ordering and retry timing between Xendit/Paddle payment notifications and refund/chargeback notifications are outside the repository.

**Validation Plan:**
- **Local (Bounded Fixture):** In a sandboxed local Deno + Postgres/PGlite harness, insert a 'pending' (or 'expired'/'failed') Xendit or Paddle order in public.orders with provider_ref set, POST a validly signed refund.succeeded or approved full adjustment.* webhook (observing HTTP 200 OK, webhook_events.processed_at populated, and orders.status unchanged), then POST the corresponding signed PAID or transaction.completed webhook and verify orders.status transitions to 'paid', grantOrder grants Premium, and redelivering the refund event returns { ok: true, duplicate: true }.
- **Deployment (Owner-Observed Read-Only):** Owner-observed verification of Xendit and Paddle webhook delivery ordering, independent queue dispatch (e.g., Xendit invoice vs refund callbacks), and retry schedules when initial payment webhooks suffer transient 5xx/timeouts.

---

<a id="lead-13"></a>

### 13. Xendit refund.succeeded coerces null refund amount to 0 and skips entitlement revocation as partial_refund

- **Fingerprint:** `webhooks/xendit-null-refund-amount-coercion`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
xendit-webhook applies Number(body.data?.amount) without checking typeof body.data?.amount === 'number' (or body.data?.amount != null), causing null (or '') to coerce to finite 0 and enter the partial_refund early-return branch instead of revoking entitlement via refundOrder.

**Description:**  
In supabase/functions/xendit-webhook/index.ts, RefundCallback explicitly types data.amount as 'number | null' (line 14), and readJson (line 20) parses the POST payload without runtime schema validation. For an authenticated refund.succeeded callback carrying data.amount: null (or ''), Number(body.data?.amount) at line 31 evaluates to 0 rather than NaN. Because 0 satisfies Number.isFinite(0) and all Xendit prices in public.prices are strictly positive (IDR 25000/250000 or MYR 690/6900), line 32 evaluates 0 < minorToMajor(order.amount, exponentOf(order.currency)) as true, sets orders.grant_error = 'partial_refund' (line 33), and returns HTTP 200 { ok: true, partial: true } (line 34) without calling refundOrder (line 36). handleEventOnce then calls webhook_done (_shared/entitlement.ts:187), marking webhook_events.processed_at so retries are dropped, while entitlement-sync (line 28) ignores 'partial_refund' orders and admin-user revoke (line 35) operates only on 'manual' orders, leaving the refunded user's Premium entitlement active.

**Ordered Trace:**
1. **`entrypoint`** — `supabase/functions/xendit-webhook/index.ts:16` (`serve`): Receives POST /functions/v1/xendit-webhook (verify_jwt = false), verifies x-callback-token with verifyStaticToken (line 19), and parses JSON without schema validation via readJson (line 20).
2. **`propagation`** — `supabase/functions/xendit-webhook/index.ts:23` (`serve`): Matches refund.succeeded with body.data?.id and body.data.invoice_id, claims idempotency in handleEventOnce (line 26), and fetches the positive-amount Xendit order by provider_ref (line 27).
3. **`propagation`** — `supabase/functions/xendit-webhook/index.ts:31` (`handleEventOnce callback`): Evaluates const refunded = Number(body.data?.amount), coercing null (explicitly typed in RefundCallback at line 14) to finite 0 rather than NaN.
4. **`propagation`** — `supabase/functions/xendit-webhook/index.ts:32` (`handleEventOnce callback`): Evaluates Number.isFinite(0) && 0 < minorToMajor(order.amount, exponentOf(order.currency)) as true for every Xendit order because public.prices enforces amount > 0.
5. **`sink`** — `supabase/functions/xendit-webhook/index.ts:33` (`handleEventOnce callback`): Updates orders.grant_error = 'partial_refund' and returns HTTP 200 { ok: true, partial: true } (line 34) without calling refundOrder (line 36); handleEventOnce then records webhook_done (_shared/entitlement.ts:187), preventing retries and leaving Premium entitlement active.

**Verified Source Evidence:**
- `supabase/config.toml:482` — Sets verify_jwt = false on [functions.xendit-webhook], relying on x-callback-token inside the function.
- `supabase/functions/xendit-webhook/index.ts:14` — RefundCallback explicitly types data.amount as optional and nullable (amount?: number | null).
- `supabase/functions/xendit-webhook/index.ts:31` — Number(body.data?.amount) coerces null (and '') to 0 instead of NaN, triggering the partial_refund branch at lines 32-35 and skipping refundOrder at line 36.
- `supabase/migrations/20261106000005_monetization.sql:174` — All Xendit rows in public.prices have positive amounts (IDR 25000/250000 and MYR 690/6900; check amount > 0 at line 169), making minorToMajor(order.amount, exponentOf(order.currency)) strictly > 0.
- `supabase/functions/_shared/entitlement.ts:187` — handleEventOnce executes webhook_done once the callback returns HTTP 200 { ok: true, partial: true }, setting processed_at so webhook_claim (20261116000019_billing_guards.sql:70-77) rejects future redeliveries as duplicates.
- `supabase/functions/entitlement-sync/index.ts:28` — Cron entitlement-sync filters .neq('grant_error', 'partial_refund') and never revokes paid orders marked partial_refund.
- `supabase/functions/admin-user/index.ts:35` — Admin revoke action queries only .eq('provider', 'manual'), leaving no admin-UI revocation path for Xendit orders marked partial_refund.

**Exact Blockers:**
- Host Linux kernel enforces apparmor_restrict_unprivileged_userns=1 without bwrap, firejail, nsjail, deno, or Docker, blocking local execution of xendit-webhook against a fixture payload.
- Whether Xendit's live or test-mode refund.succeeded webhook for v2/invoices payments (IDR/MYR channels) ever sends data.amount: null on a full refund is an external third-party payload behavior outside the repository.

**Validation Plan:**
- **Local (Bounded Fixture):** Execute supabase/functions/xendit-webhook/index.ts in an isolated local Deno 2 + Postgres/PGlite harness with a paid Xendit order (e.g., IDR 25000) and submit a valid x-callback-token POST for event 'refund.succeeded' with data.amount: null; verify in the test database that orders.grant_error becomes 'partial_refund', orders.status remains 'paid', webhook_events.processed_at is set, and profiles.plan remains 'premium'.
- **Deployment (Owner-Observed Read-Only):** In a non-production Xendit test-mode account configured against an isolated test webhook receiver, pay a test v2 invoice (IDR/MYR) and issue a full refund; inspect Xendit's delivered refund.succeeded JSON payload to observe whether data.amount can be null, empty, or omitted.

---

## External Proxies, AI/LLM Pipelines & Shared Quota / Resource Limits

<a id="lead-14"></a>

### 14. Unvalidated and unbounded custom asset symbols in public.assets starve hourly asset-prices-sync and amplify Yahoo/TradingView traffic

- **Fingerprint:** `arshif:external-proxies:asset-prices-sync-unbounded-custom-symbols-starvation`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
public.assets permits unbounded (for active Premium) arbitrary symbols for stock_id, stock_us, and crypto without a server-side allowlist, and asset_price_keys() plus asset-prices-sync process all distinct global keys sorted alphabetically in sequential 200-key batches with no per-tenant symbol cap, failed-symbol backoff, suspended/expired-owner exclusion, or global runtime budget.

**Description:**  
Authenticated users can insert or update rows in public.assets via PostgREST (or upsert up to 500 rows per call via restore_rows) with any 1-15 character uppercase alphanumeric/dot symbol (symbol ~ '^[A-Z0-9.]{1,15}$') for stock_id, stock_us, and crypto, bypassing the client-side SymbolPicker allowlist. Only gold is constrained to symbol = 'XAU', while active Premium users have unlimited assets (plan_limits monthly_limit = null in effective_plan/enforce_total_limit). Across all 33 Postgres migrations, public.asset_price_keys() returns all distinct non-null price_key values across all tenants globally sorted alphabetically with no cap, no failed-symbol backoff, and no exclusion for suspended or expired-Premium accounts. Hourly asset-prices-sync iterates through keys sequentially in 200-key batches (syncInBatches). Non-CoinGecko CRYPTO:* keys are skipped by coinGeckoProvider and routed straight to tradingViewProvider (CONCURRENCY = 4, TIMEOUT_MS = 15,000 per candidate over one TradingViewClient), while bogus US:*/IDX:* keys query up to 2 Yahoo hosts (CONCURRENCY = 4, TIMEOUT_MS = 8,000, sharing Yahoo egress with symbol-search) and then also fall back to tradingViewProvider. Because CRYPTO:* sorts lexicographically before GOLD:XAU, IDX:*, and US:* (and CRYPTO:0* or CRYPTO:AAA* sorts ahead of legitimate CRYPTO:BTC/ETH), persistent attacker-inserted keys fill Batch 0 and early batches on every hourly run, amplifying upstream requests and risking Edge Function wall-clock timeout before legitimate tenants' asset_prices, asset_price_history, and price_alerts updates occur.

**Ordered Trace:**
1. **`entrypoint`** — `supabase/migrations/20261114000016_assets.sql:112` (`PostgREST INSERT public.assets`): Authenticated users hold column-level INSERT/UPDATE grants on public.assets.symbol (lines 112, 114) constrained only by symbol ~ '^[A-Z0-9.]{1,15}$' (line 12) and assets_limit (line 101; monthly_limit = null for Premium at line 88), letting direct PostgREST or restore_rows('assets', ...) bypass client SymbolPicker checks and persist arbitrary CRYPTO/IDX/US symbols.
2. **`propagation`** — `supabase/migrations/20261116000020_price_keys_keep_orders.sql:8` (`public.asset_price_keys`): Aggregates all distinct non-null price_key values across all tenants ordered alphabetically without row limit, per-tenant cap, or filtering for suspended or expired-Premium owners.
3. **`propagation`** — `supabase/functions/asset-prices-sync/index.ts:49` (`asset-prices-sync`): Hourly cron invokes db.rpc('asset_price_keys') (line 49) and passes the full sorted key list to syncInBatches using chainProvider(PRIMARIES, tradingViewProvider, runs) (lines 54-58).
4. **`propagation`** — `supabase/functions/_shared/asset-sync.ts:83` (`syncInBatches`): Processes keys sequentially in 200-key slices (SYNC_BATCH = 200 at line 69); attacker CRYPTO:0* or CRYPTO:AAA* keys occupy Batch 0 ahead of legitimate CRYPTO:BTC, GOLD:XAU, IDX:*, and US:* keys.
5. **`propagation`** — `supabase/functions/_shared/price-coingecko.ts:23` (`coinGeckoProvider.handles`): Handles only the 18 symbols in COINGECKO_IDS, causing all bogus CRYPTO:* keys to fall straight through to fallback tradingViewProvider (asset-sync.ts:134-135), while yahooUsProvider/yahooIdxProvider query up to 2 Yahoo hosts per fake US/IDX key (price-yahoo.ts:38-53) before failed keys also fall back to TradingView.
6. **`sink`** — `supabase/functions/_shared/tradingview.ts:17` (`quoteFor`): Called from tradingViewProvider.fetch (line 39) over one TradingViewClient at CONCURRENCY = 4 (line 11) and TIMEOUT_MS = 15,000 per candidate (line 10), exhausting Edge Function wall-clock runtime or triggering shared Yahoo/TradingView throttling before subsequent batches persist asset_prices for other tenants.

**Verified Source Evidence:**
- `supabase/migrations/20261114000016_assets.sql:12` — symbol column validates only ^[A-Z0-9.]{1,15}$ (only type = 'gold' pins symbol = 'XAU' at line 34), plan_limits sets Premium assets monthly_limit = null (line 88), and authenticated receives INSERT/UPDATE grants on symbol (lines 112, 114).
- `supabase/migrations/20261121000022_audit_fixes.sql:61` — Updated enforce_total_limit() enforces limits via effective_plan(p.plan, p.premium_until), leaving active Premium users uncapped when v_limit is null.
- `supabase/migrations/20261122000026_restore_rows.sql:40` — restore_rows allowlists 'assets' up to 500 rows per RPC call, inheriting only the table's regex check and enforce_total_limit trigger.
- `supabase/migrations/20261116000020_price_keys_keep_orders.sql:8` — asset_price_keys() returns array_agg(distinct price_key order by price_key) across all rows in public.assets with no per-tenant limit or owner-status filter.
- `scripts/db-test.mjs:952` — Database test verifies asset_price_keys() returns over 1,000 unique price_key strings globally sorted alphabetically without PostgREST max_rows truncation.
- `supabase/migrations/20261114000017_cron_assets.sql:2` — pg_cron schedules asset-prices-sync hourly at minute 10 ('10 * * * *').
- `supabase/functions/asset-prices-sync/index.ts:49` — Calls db.rpc('asset_price_keys') and executes syncInBatches sequentially across all returned keys (line 58).
- `supabase/functions/_shared/asset-sync.ts:69` — SYNC_BATCH = 200 runs sequentially in syncInBatches (lines 83-89) and chainProvider routes all unhandled or failed primary keys to tradingViewProvider (lines 134-135).
- `supabase/functions/_shared/price-yahoo.ts:10` — Code comment warns that single-symbol Yahoo polling at CONCURRENCY = 4 (line 11) and TIMEOUT_MS = 8_000 (line 9) across up to 2 hosts (line 8) can exceed function time limits above ~200 symbols.
- `supabase/functions/_shared/tradingview.ts:10` — Sets TIMEOUT_MS = 15_000 (line 10) and CONCURRENCY = 4 (line 11) in quoteFor/tradingViewProvider.fetch over a single TradingViewClient.

**Exact Blockers:**
- Host OS sandbox restrictions (apparmor_restrict_unprivileged_userns=1, no bwrap/firejail/nsjail/deno/Docker) prevent executing Deno Edge Functions or local test harnesses.
- Exact @mathieuc/tradingview v4.1.1 getQuote failure latency on unknown symbols (immediate protocol error vs full 15s TIMEOUT_MS), Yahoo Finance IP block/429 thresholds on shared egress, and deployed Supabase Edge Function wall-clock execution limit are external to repository source.

**Validation Plan:**
- **Local (Bounded Fixture):** In an isolated Deno test fixture with a mocked DB returning 400 sorted keys (200 CRYPTO:AAA001..AAA200 + 200 GOLD:XAU/IDX/US keys) and mocked Yahoo/TradingView providers delaying 15s on unknown symbols, measure syncInBatches duration and verify legitimate later batches fail to execute before an imposed Edge Function wall-clock limit.
- **Deployment (Owner-Observed Read-Only):** Ask the project owner for Supabase project gyxtdpmruuhhkprlhlrk to confirm the deployed Edge Function plan tier and wall-clock execution limit for asset-prices-sync, and passively inspect existing public.asset_price_runs rows (source, symbols, updated, failed, error, duration_ms), Edge Function logs for asset-prices-sync and symbol-search, and read-only distinct price_key counts in public.assets without sending synthetic test traffic.

---

<a id="lead-15"></a>

### 15. Per-isolate in-memory rate limit and evictable cache in symbol-search allow bypassing Yahoo Finance throttling from shared server IP

- **Fingerprint:** `arshif:external-proxies:symbol-search-per-isolate-rate-limit-yahoo-ip-ban`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
symbol-search tracks per-user rate limits and search cache solely in per-isolate module memory Maps without global Postgres enforcement or daily quotas, allowing uncached Yahoo Finance search traffic from the shared server IP to exceed intended limits.

**Description:**  
POST /functions/v1/symbol-search proxies any authenticated user's queries (including Free accounts since enable_signup = true) to Yahoo Finance (query2.finance.yahoo.com/v1/finance/search) using a module-level calls Map (PER_MINUTE = 30, never pruned for inactive users) and a module-level 500-entry FIFO cache Map. Across all 33 Postgres migrations and supabase/config.toml, there is no database-backed rate-limit RPC, daily cap, or upstream Edge Function throttle for symbol-search (unlike places, which enforces place_lookup_start atomically in Postgres at 30/min and 300/day, and AI endpoints, which enforce ai_job_start). An authenticated user can supply distinct 1-40 character q strings to miss and evict the 500-entry cache and distribute requests across Edge Function isolates or cold restarts to exceed 30 req/min. Because symbol-search comments explicitly warn against getting the shared server IP blocked by Yahoo (which asset-prices-sync also relies on in _shared/price-yahoo.ts, where unofficial endpoint blocking and 429/403 rejections without a browser User-Agent are noted), IP throttling from Yahoo breaks symbol-search with 502 provider_error for all users (disrupting US stock search in SymbolPicker.tsx, which has no local US list, and IDX IPO search) and degrades asset-prices-sync's primary Yahoo US/IDX feeds onto the unofficial @mathieuc/tradingview fallback.

**Ordered Trace:**
1. **`entrypoint`** — `supabase/functions/symbol-search/index.ts:17` (`serve`): Authenticated user (requireUser on line 18) submits POST /functions/v1/symbol-search with valid SymbolSearchRequest (market 'US'|'IDX' and trimmed 1-40 char query q).
2. **`propagation`** — `supabase/functions/symbol-search/index.ts:24` (`calls & cache check`): Enforces PER_MINUTE = 30 against isolate-local calls Map and checks isolate-local 500-entry cache Map (lines 28-30) with no Postgres advisory lock, daily cap, or cross-isolate state.
3. **`propagation`** — `supabase/functions/symbol-search/index.ts:34` (`searchSymbols call & FIFO eviction`): On cache miss, invokes searchSymbols(market, q) and evicts the oldest entry when cache.size >= 500 (lines 39-40), allowing unique q strings to churn the cache.
4. **`sink`** — `supabase/functions/_shared/symbol-search.ts:33` (`searchSymbols`): Calls getJson (price-http.ts:5) to issue an outbound HTTP GET to https://query2.finance.yahoo.com/v1/finance/search from Supabase Edge Function egress also used by asset-prices-sync.

**Verified Source Evidence:**
- `supabase/functions/symbol-search/index.ts:2` — Header comment explicitly states per-user rate limiting exists to stop one client from getting the server IP blocked by Yahoo (also used for price sync), and line 13 notes the cache and rate limit are per-instance memory only.
- `supabase/functions/symbol-search/index.ts:14` — cache (CACHE_MAX = 500, CACHE_MS = 10 min) and calls (PER_MINUTE = 30) are module-level Maps; calls never deletes expired user entries and line 39 performs FIFO eviction on cache misses.
- `supabase/functions/_shared/contracts.ts:295` — SymbolSearchRequest allows market 'IDX'|'US' and any trimmed 1-40 character q string, enabling trivial cache-busting and cache eviction.
- `supabase/functions/_shared/symbol-search.ts:32` — Builds https://query2.finance.yahoo.com/v1/finance/search?q= URL and issues outbound fetch via getJson (supabase/functions/_shared/price-http.ts:5) on every cache miss.
- `supabase/functions/_shared/price-yahoo.ts:8` — asset-prices-sync queries query1.finance.yahoo.com and query2.finance.yahoo.com for US and IDX prices; line 2 notes the public Yahoo chart endpoint is unofficial and can be blocked, and line 12 notes Yahoo frequently rejects requests with 429/403 without a browser User-Agent.
- `supabase/functions/asset-prices-sync/index.ts:54` — chainProvider falls back to unofficial @mathieuc/tradingview when primary Yahoo providers fail, whereas symbol-search has no fallback provider and returns 502 provider_error (symbol-search/index.ts:37).
- `src/features/assets/SymbolPicker.tsx:48` — stock_us has an empty local symbol list and depends entirely on symbol-search for discovery, falling back only to manual typed code entry after an error (line 87).
- `supabase/functions/places/index.ts:54` — Unlike symbol-search, places enforces cross-isolate rate limits atomically in Postgres via place_lookup_start (supabase/migrations/20261121000023_tx_place.sql:29, 30/min and 300/day).
- `supabase/config.toml:177` — enable_signup = true permits unprivileged Free account creation, and line 456 configures verify_jwt = false on symbol-search with no Edge Function rate-limit setting in source.

**Exact Blockers:**
- Host OS sandbox restrictions (apparmor_restrict_unprivileged_userns=1, no Deno/container isolation) prevent executing Edge Functions locally.
- Deployed Supabase Edge Function isolate concurrency/recycling, upstream platform gateway rate limits, egress NAT IP sharing between symbol-search and asset-prices-sync, and Yahoo Finance IP rate-limit/ban thresholds and recovery behavior are external to the repository.

**Validation Plan:**
- **Local (Bounded Fixture):** In an isolated Deno test fixture pointing Yahoo search URLs at a local mock HTTP server, run two independent symbol-search worker isolates and verify a single authenticated user token can exceed 30 uncached requests/minute across isolates and evict prior cached entries with 500 unique 1-40 character q payloads.
- **Deployment (Owner-Observed Read-Only):** Check hosted Supabase Edge Function gateway limits, worker scaling, and outbound NAT IP sharing between symbol-search and asset-prices-sync, and validate in staging whether migrating symbol-search rate limits to an advisory-locked Postgres RPC (matching place_lookup_start) prevents cross-isolate bursts.

---

<a id="lead-16"></a>

### 16. Missing content validation, unbounded VoiceAccount strings, ~5-6x isolate memory expansion, and post-AI unreadable quota refunds across AI ingestion Edge Functions

- **Fingerprint:** `arshif:resource-limits:ai-ingestion-representation-amplification-and-unreadable-refund`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
AI ingestion Edge Functions rely only on raw byte/char caps (15 MiB / 8 MiB / 2.8M chars), Storage upload Content-Type metadata, path extensions, and a partial head/tail /Encrypt substring scan while buffering multiple uncompressed, base64, and JSON-serialized copies in isolate RAM, omitting magic-byte, PDF page-count, image-dimension, and VoiceAccount string-length/deduplication validation before dispatching up to 3 Gemini requests, and refunding consumed monthly quotas via quota_refund when post-AI parsing fails or yields unreadable results.

**Description:**  
Authenticated users can trigger substantial isolate heap expansion, unvalidated upstream Gemini API work, and quota-bypassing refunds via import-statement, scan-receipt, and voice-log. In import-statement, the handler enforces only MAX_BYTES (15 MiB) and a partial head/tail /Encrypt scan (first 65,536 bytes and last 4,096 bytes) without checking PDF magic bytes or page counts (PRD FR-PDF-1 sets a 30-page limit; ImportResult only requires a non-negative integer pages), then retains the downloaded Blob (up to 15 MiB) and Uint8Array (15 MiB) alongside toBase64() intermediate binary and btoa() (~20 MiB) strings and ai.ts JSON.stringify()/fetch copies (~20 MiB each), reaching roughly 5x-6x raw payload allocation in isolate memory across up to 3 retry attempts (15s timeout each). In scan-receipt, mimeType is selected solely from the path extension (defaulting unknown/missing extensions to image/jpeg and allowing application/pdf up to 8 MiB per migration 20261122000024_receipts_pdf.sql) with no magic-byte, image-dimension, PDF page-count, or /Encrypt check; because scan-receipt does not delete Storage objects after processing, a single 8 MiB upload can be replayed across 10 concurrent requests per minute. In voice-log, VoiceAccount defines name and bank as unbounded z.string() fields across up to 50 entries filtered only by ownedIds.has(a.id) without deduplication or DB lookup, allowing a user with one owned account to inject multi-megabyte repeated strings into voicePrompt alongside an unvalidated audio payload (up to 2,800,000 chars) under unlimited monthly automation quota on Premium. Across all three functions, runAiJob executes quota_refund whenever work() throws after Gemini calls—including unreadable (422) when 0 rows/items or null are extracted—allowing even Free accounts (1/mo importPdf, 20/mo scan, 30/mo automation) to replay unvalidated payloads at up to 10 requests/min without exhausting monthly quotas. Locally supabase/config.toml sets edge_runtime policy to per_worker and enable_signup = true, while deployed functions share one operator GEMINI_API_KEY; depending on deployed worker isolation, memory ceiling, HTTP body cap, and Gemini API behavior, concurrent amplified requests risk exhausting shared worker memory and project-level Gemini quotas/spend.

**Ordered Trace:**
1. **`entrypoint`** — `supabase/functions/import-statement/index.ts:23` (`serve (POST /functions/v1/import-statement)`): Authenticated user invokes import-statement (or scan-receipt / voice-log) with a Storage object path or inline VoiceRequest JSON payload after authenticating via requireUser.
2. **`propagation`** — `supabase/functions/_shared/guard.ts:31` (`runAiJob`): ai_job_start allows up to 10 'started' AI jobs per minute per user (RATE_LIMIT_PER_MIN = 10) that can run concurrently, and quota_try_consume checks monthly limits (scan: 20/300, importPdf: 1/10, automation: 30/unlimited) before work() runs.
3. **`propagation`** — `supabase/functions/import-statement/index.ts:39` (`import-statement work()`): Downloads up to 15 MiB into Blob (line 36) and Uint8Array (line 39) and scans only 64 KiB head / 4 KiB tail in isEncrypted() (lines 17-21, 40) without PDF magic-byte or page-count checks before encoding; similarly, scan-receipt/index.ts:30-32 picks mimeType from filename extension on up to 8 MiB without magic-byte, dimension, page-count, or /Encrypt checks.
4. **`propagation`** — `supabase/functions/_shared/auth.ts:33` (`toBase64`): Constructs an intermediate binary string in 32 KiB chunks and encodes via btoa(), adding ~15-30 MiB intermediate plus ~20 MiB base64 heap allocation (for 15 MiB input) while Blob and Uint8Array remain in scope.
5. **`propagation`** — `supabase/functions/_shared/contracts.ts:88` (`VoiceAccount`): Defines unbounded name and bank strings across up to 50 VoiceAccount entries; voice-log/index.ts:20 filters only by ownedIds.has(a.id) without deduplication or DB lookup before _shared/prompts.ts:142 interpolates them into voicePrompt.
6. **`sink`** — `supabase/functions/_shared/ai.ts:47` (`callModel`): Serializes the prompt and inline base64 payload with JSON.stringify and dispatches fetch() to Gemini across up to 3 attempts (generateJson lines 26-33, 15,000 ms timeout each), retaining large buffers in isolate RAM and consuming shared GEMINI_API_KEY quotas.

**Verified Source Evidence:**
- `supabase/functions/import-statement/index.ts:17` — isEncrypted() checks only the last 4,096 bytes and first 65,536 bytes for '/Encrypt', lines 38-41 enforce only MAX_BYTES (15 MiB) without validating PDF magic bytes or page count (PRD FR-PDF-1 at docs/arshif-prd.md:67 sets a 30-page limit), and line 43 throws unreadable (422) when 0 rows are parsed after calling Gemini.
- `supabase/functions/scan-receipt/index.ts:30` — Derives mimeType solely from path extension (MIME[ext] ?? 'image/jpeg' at lines 13 and 30-32) on up to 8 MiB files (including PDFs) with no magic-byte, image-dimension, PDF page-count, or /Encrypt check, never removes the Storage object after processing, and throws unreadable (422) at line 35 when normalizeScan returns null.
- `supabase/migrations/20261122000024_receipts_pdf.sql:2` — Adds 'application/pdf' to the receipts bucket allowed_mime_types (8 MiB cap from 20261105000003_storage.sql:3), which Storage validates against upload Content-Type metadata rather than payload magic bytes.
- `supabase/functions/_shared/contracts.ts:88` — VoiceAccount leaves name and bank as unbounded z.string() fields within an array of max 50 items (line 96), and audio (line 90, max 2,800,000 chars) lacks base64/audio magic-byte validation; voice-log/index.ts:20 only checks ownedIds.has(a.id) without deduplication and throws unreadable (422) at line 31 when 0 items are extracted.
- `supabase/functions/_shared/auth.ts:33` — toBase64() builds a concatenated binary string in 32 KiB chunks and btoa() output in isolate RAM alongside the retained Blob and Uint8Array before _shared/ai.ts:47 JSON.stringify() and fetch() allocate additional payload copies.
- `supabase/functions/_shared/ai.ts:26` — generateJson() retries [primary, ...rest, primary] (up to 3 Gemini API calls with 15,000 ms timeout each at line 6) on retryable errors/timeouts while retaining parts in closure memory.
- `supabase/functions/_shared/guard.ts:54` — runAiJob() calls quota_refund when work() throws (including 422 unreadable or 502 ai_failed after Gemini invocation), allowing repeated calls up to RATE_LIMIT_PER_MIN = 10 (line 8; enforced in 20261116000019_billing_guards.sql:18) without exhausting monthly quotas (20261105000001_schema.sql:194-195).
- `supabase/config.toml:387` — Configures local edge_runtime policy = 'per_worker' and enable_signup = true (line 177), while Edge Functions share one GEMINI_API_KEY (_shared/env.ts:24).

**Exact Blockers:**
- Host OS sandbox restrictions (apparmor_restrict_unprivileged_userns=1; no bwrap, firejail, nsjail, deno, or Docker) prevent executing Deno Edge Functions or measuring isolate heap/RSS amplification locally.
- Deployed Supabase Edge Function per-worker memory ceiling, multi-tenant worker concurrency/OOM isolation behavior, deployed Auth signup setting, and HTTP request body size limit (bounding voice-log readJson) are platform runtime/project settings not visible in the repository.
- Upstream Google Gemini API PDF page-count/input-token limits, timeout/429 behavior, and billing charges on multi-hundred-page PDFs, mid-offset /Encrypt PDFs, mismatched MIME payloads, and large VoiceAccount prompts are external service behaviors outside repository source.

**Validation Plan:**
- **Local (Bounded Fixture):** Inside an isolated Deno 2 runtime with a bounded V8 heap (e.g., --v8-flags=--max-old-space-size=150) and mocked local Storage/Gemini/Postgres RPC endpoints, invoke (1) 10 concurrent scan-receipt requests against a single 8 MiB valid multi-page PDF and 10 concurrent import-statement requests (under a Premium test profile with 10/mo importPdf quota, or 10 distinct Free users) against 15 MiB valid, unreadable, and mid-offset /Encrypt PDFs to measure peak isolate RSS, OOM failure, and quota_refund behavior, and (2) voice-log with 1 owned account row and 50 duplicate VoiceAccount entries carrying large name/bank strings to observe prompt/JSON memory allocation.
- **Deployment (Owner-Observed Read-Only):** Ask the project owner to inspect the deployed Supabase project's Edge Function runtime settings and logs (per-worker memory ceiling, worker concurrency/OOM isolation/restart behavior, HTTP request body limit, and deployed Auth signup configuration) and review the Google AI Studio / Gemini project's model limits (PDF page/token caps, RPM/TPM quotas, and billing budget alerts) without sending audit or stress-test traffic to the deployment.

---

<a id="lead-17"></a>

### 17. Post-inference quota_refund in runAiJob bypasses daily and monthly AI usage quotas

- **Fingerprint:** `supabase/functions/_shared/guard.ts:runAiJob-post-inference-quota-refund`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
runAiJob catches all callback errors—including post-inference domain rejections (422 unreadable and 502 ai_failed) raised after generateJson has already invoked the billed Gemini API—and unconditionally invokes quota_refund without any daily or monthly ceiling on failed or refunded AI jobs in ai_job_start or quota_refund.

**Description:**  
In supabase/functions/_shared/guard.ts, runAiJob calls quota_try_consume before executing the handler callback and unconditionally calls quota_refund whenever the callback throws, regardless of whether generateJson has already sent an operator-billed request to the Gemini API. Across scan-receipt, voice-log, and import-statement, an authenticated Free or Premium user can submit inputs that intentionally fail post-inference normalization (e.g., non-receipt image/PDF yielding null total in scan-receipt, silent/non-financial audio yielding empty items in voice-log, or non-statement PDF yielding empty rows in import-statement), causing the handler to throw HttpError('unreadable', 422) after generateJson executes. Similarly, coach-price (for Premium users with a 20/day coachAsk quota), coach (coachNarration 10/day Free, 30/day Premium), and coach-ask (20/day Premium) throw HttpError('ai_failed', 502) post-inference when normalization rejects model output (such as normalizePrice rejecting estimates outside 0.5x-2x of caller-supplied livePrice) or late model failures occur, also triggering quota_refund. Across all 33 Postgres migrations, ai_job_start enforces only a 10-requests-per-minute rolling window with no daily or monthly cap on failed or refunded AI jobs, and quota_refund decrements usage_counters.used without limit. Consequently, an authenticated user pacing calls at up to 10/minute can repeatedly trigger operator-billed Gemini inferences (and in scan-receipt, replay small JSON POSTs against one retained non-receipt object in the receipts bucket) without consuming their monthly scan (20 Free / 300 Premium), importPdf (1 Free / 10 Premium), automation (30 Free), or daily coachAsk/coachNarration quotas, risking cross-tenant Gemini API quota exhaustion and unbounded operator billing.

**Ordered Trace:**
1. **`entrypoint`** — `supabase/functions/scan-receipt/index.ts:15` (`scan-receipt HTTP POST handler`): Authenticated user invokes POST scan-receipt (auth verified by requireUser and storage ownership checked by assertOwnPath) referencing a retained non-receipt file in their receipts folder.
2. **`propagation`** — `supabase/functions/_shared/guard.ts:31` (`runAiJob rate limit and quota debit`): runAiJob calls ai_job_start (enforcing only 10 requests per 1-minute sliding window) and quota_try_consume for 'scan' before invoking the work() callback.
3. **`propagation`** — `supabase/functions/scan-receipt/index.ts:32` (`scan-receipt work callback`): Handler downloads the file from the receipts bucket and calls generateJson(scanPrompt(...), SCAN_SCHEMA, inline), dispatching the payload to Gemini before validating receipt fields (similarly import-statement calls generateJson at line 41, voice-log at line 24, and coach-price at line 21).
4. **`propagation`** — `supabase/functions/_shared/ai.ts:43` (`callModel Gemini REST request`): callModel posts the prompt and inline base64 media to Gemini using the shared operator GEMINI_API_KEY (and retries fallback/primary models on retryable errors), incurring operator inference cost and shared API quota consumption.
5. **`propagation`** — `supabase/functions/scan-receipt/index.ts:35` (`scan-receipt post-inference validation`): normalizeScan returns null when the extracted total is missing or non-positive, causing the handler to throw HttpError('unreadable', 422) (likewise empty rows/items throw 422 unreadable in import-statement/voice-log, and failed normalization throws 502 ai_failed in coach-price/coach/coach-ask).
6. **`sink`** — `supabase/functions/_shared/guard.ts:54` (`runAiJob catch block quota refund`): catch block unconditionally calls quota_refund(p_user, p_key, p_at), decrementing usage_counters.used back down so the billed Gemini call is not counted against daily or monthly plan limits.

**Verified Source Evidence:**
- `supabase/functions/_shared/guard.ts:38` — quota_try_consume debits usage_counters before work() runs; line 54 unconditionally invokes quota_refund on any thrown error from work().
- `supabase/functions/_shared/guard.ts:54` — Unconditional quota_refund call inside runAiJob catch(e) executes even after generateJson completes a billed Gemini API request and post-inference normalization rejects the result.
- `supabase/migrations/20261116000019_billing_guards.sql:18` — ai_job_start bounds ai_jobs count only over a 1-minute sliding window (p_limit = 10) with no daily or monthly cap on failed or refunded AI jobs.
- `supabase/migrations/20261121000022_audit_fixes.sql:48` — quota_refund decrements usage_counters.used for the request period (greatest(used - 1, 0)) without tracking or capping repeated post-inference refunds.
- `supabase/migrations/20261105000001_schema.sql:194` — plan_limits sets finite Free monthly limits of 20 scan, 30 automation, and 1 importPdf (and Premium 300 scan, 10 importPdf).
- `supabase/migrations/20261106000005_monetization.sql:17` — plan_limits sets coachAsk daily limits to 0 for Free (blocked pre-inference by quota_try_consume) and 20/day for Premium.
- `supabase/functions/scan-receipt/index.ts:35` — scan-receipt downloads an object from receipts (never deleted after scan), invokes generateJson at line 32, and throws HttpError('unreadable', 422) when normalizeScan returns null.
- `supabase/functions/import-statement/index.ts:43` — import-statement invokes generateJson at line 41 and throws HttpError('unreadable', 422) when parsed.rows.length === 0, refunding the 1/month Free importPdf quota.
- `supabase/functions/voice-log/index.ts:31` — voice-log invokes generateJson at line 24 and throws HttpError('unreadable', 422) when voice.items.length === 0, refunding the 30/month Free automation quota.
- `supabase/functions/coach-price/index.ts:22` — coach-price invokes generateJson at line 21 with caller-supplied asset.livePrice and throws HttpError('ai_failed', 502) when normalizePrice rejects out-of-range estimates (outside 0.5x-2x livePrice), refunding the 20/day Premium coachAsk quota.
- `supabase/functions/coach/index.ts:35` — coach invokes generateJson at line 33 and throws HttpError('ai_failed', 502) when normalizeCoach returns null, refunding coachNarration (10/day Free, 30/day Premium).
- `supabase/functions/coach-ask/index.ts:24` — coach-ask invokes generateJson at line 22 and throws HttpError('ai_failed', 502) when normalizeAsk returns null, refunding coachAsk (20/day Premium).

**Exact Blockers:**
- Host kernel enforces apparmor_restrict_unprivileged_userns=1 and lacks bwrap, firejail, nsjail, deno, and Docker isolation, preventing bounded local execution of Deno Edge Functions and PGlite quota-refund harnesses.
- Deployed upstream controls outside the repository (Google Gemini API project spend and RPM/TPM/RPD quotas, Supabase Edge Function/API gateway rate caps, and Supabase Storage egress caps) are not source-visible.

**Validation Plan:**
- **Local (Bounded Fixture):** Inside an approved OS-sandboxed Deno + PGlite harness with outbound Gemini HTTP requests intercepted locally to return a valid JSON candidate matching SCAN_SCHEMA with total: null (and Storage mocked to serve a small dummy JPEG), send >20 scan-receipt requests for a dummy Free user paced outside the 1-minute ai_job_start window (or with mocked DB timestamps), and verify that the Gemini endpoint is called >20 times and ai_jobs records status='failed' with error='unreadable' while usage_counters.used for 'scan' remains 0; repeat for import-statement (rows: [], >1 call for Free user), voice-log (items: [], >30 calls for Free user), and coach-price (dummy Premium user, >20 calls returning targetLow/targetHigh outside 0.5x-2x of livePrice).
- **Deployment (Owner-Observed Read-Only):** Owner-observed check: inspect Supabase Edge Function invocation logs and ai_jobs counts grouped by (user_id, status, error) for repeated 422/502 errors, and verify Google Cloud Gemini API daily/monthly spend caps, project RPM/TPM/RPD limits, and Supabase API Gateway/WAF throttling policies.

---

## Data Lifecycle, Account Deletion, Backup & Local State Isolation

<a id="lead-18"></a>

### 18. Account deletion leaves private storage objects orphaned and allows pagination amplification via cleanup failures, nested paths, and unbounded storage uploads

- **Fingerprint:** `account-deletion/incomplete-storage-cleanup-on-failure-and-nested-paths`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
supabase/functions/_shared/account.ts deletes auth.users before storage, swallows bucket-loop exceptions into {deleted:true, filesPending:true} without a persisted retry queue or tombstone, and performs non-recursive flat list(userId) + remove() up to 100 iterations without distinguishing virtual folder entries, while storage.objects RLS policies (receipts SELECT/INSERT/DELETE, statements INSERT/DELETE, avatars SELECT/INSERT/DELETE) check only (storage.foldername(name))[1] = (select auth.uid())::text without path-depth limits, per-user object/byte quotas, or auth.users existence checks.

**Description:**  
POST /functions/v1/delete-account calls deleteAccount, which permanently deletes the auth.users row (cascading user-owned database rows and erasing references such as transactions.receipt_path, profiles.avatar_path, and profiles.cover_path, while setting orders.user_id to NULL) before sequentially deleting objects in the receipts, statements, and avatars buckets via removeFolder. Any transient Storage error in an earlier bucket aborts cleanup of remaining buckets, logs only via console.error('delete_account_files_pending', ...), and returns HTTP 200 {deleted:true, files, filesPending:true} with no persisted tombstone, retry queue, or pg_cron cleanup job across any of the 33 migrations; DataCard.tsx ignores filesPending via a permissive Zod schema and immediately executes local sign-out. Furthermore, storage.objects RLS policies on receipts (8 MiB/object, images + PDF), statements (15 MiB/object, PDF, INSERT/DELETE only), and avatars (2 MiB/object, images) enforce only (storage.foldername(name))[1] = (select auth.uid())::text with no path-depth limit and no per-user object-count or byte-volume quota. Authenticated users can directly upload objects within allowed MIME types at nested paths (<userId>/<sub>/<file>) via the Storage API without consuming AI quotas. Because removeFolder calls flat list(userId, {limit:1000}) up to 100 iterations and passes `${userId}/${f.name}` directly to storage.remove() without checking f.id === null or recursing, virtual subfolder entries match zero object keys and return no error; removeFolder spins all 100 list+remove iterations per bucket (up to 600 Storage API calls across 3 buckets), misreports virtual folders in the removed count, silently exits after 100 iterations without setting filesPending, and leaves nested objects (as well as flat buckets exceeding 100,000 objects) permanently orphaned in shared Storage. Pre-existing signed URLs (receiptUrl 600s, avatarUrl 3600s, or user-minted URLs on receipts/avatars) remain valid for undeleted objects until expiry, and storage.objects RLS checks only auth.uid() without verifying auth.users existence while jwt_expiry defaults to 3600s.

**Ordered Trace:**
1. **`entrypoint`** — `supabase/functions/delete-account/index.ts:13` (`delete-account serve handler`): Authenticated POST /functions/v1/delete-account validates {confirm:'DELETE'} and delegates user.id to deleteAccount(adminClient(), user.id).
2. **`propagation`** — `supabase/functions/_shared/account.ts:26` (`deleteAccount`): Calls db.auth.admin.deleteUser(userId) first, cascading user-owned tables (including profiles.avatar_path, profiles.cover_path, and transactions.receipt_path; setting orders.user_id to NULL) and removing DB pointers before storage cleanup begins.
3. **`propagation`** — `supabase/functions/_shared/account.ts:30` (`deleteAccount`): Sequentially iterates receipts, statements, and avatars; an exception in any earlier bucket skips remaining buckets and returns HTTP 200 {deleted:true, files, filesPending:true} at line 34 with only console.error and no persisted retry mechanism.
4. **`sink`** — `supabase/functions/_shared/account.ts:13` (`removeFolder`): Loops guard = 0..99 calling storage.list(userId, {limit:1000}) and storage.remove(paths) mapped to `${userId}/${f.name}`, failing to delete nested objects (<userId>/<sub>/<file>) permitted by Storage RLS, spinning 100 list+remove iterations per bucket on virtual folders without error, silently stopping at 100 iterations (100,000 flat entries) without flagging filesPending, and leaving objects orphaned.

**Verified Source Evidence:**
- `supabase/functions/_shared/account.ts:34` — Catches storage cleanup exceptions after deleteUser and returns {deleted:true, files, filesPending:true} after only console.error('delete_account_files_pending', ...) at line 33, with no cleanup tombstone table or pg_cron retry job in any migration.
- `supabase/functions/_shared/account.ts:8` — Caps removeFolder pagination at guard < 100 with limit:1000 (line 9), maps all list() entries directly to `${userId}/${f.name}` at line 12 without checking f.id === null or recursing, increments removed += paths.length at line 15 even when remove() deletes nothing on virtual folders, and exits without error or filesPending.
- `supabase/migrations/20261105000003_storage.sql:9` — receipts_own_select/insert/delete (lines 7-12) and statements_own_insert/delete (lines 15-18) restrict only (storage.foldername(name))[1] = (select auth.uid())::text alongside 8 MiB/15 MiB per-object limits, permitting nested paths (<userId>/sub/file) and imposing no per-user count/byte quota or auth.users existence check.
- `supabase/migrations/20261122000024_receipts_pdf.sql:2` — Expands receipts allowed_mime_types to include application/pdf alongside image/jpeg, image/png, image/heic, and image/webp while keeping bucket RLS policies and the 8 MiB per-object limit unchanged.
- `supabase/migrations/20261122000027_avatar.sql:13` — avatars_own_select (lines 11-12), avatars_own_insert (lines 13-14), and avatars_own_delete (lines 15-16) similarly enforce only (storage.foldername(name))[1] = (select auth.uid())::text with a 2 MiB per-object limit and no depth limit, aggregate user quota, or auth.users check.
- `supabase/migrations/20261122000028_cover.sql:2` — Adds profiles.cover_path referencing photo paths stored in the avatars bucket, which cascades on auth.users deletion before storage cleanup.
- `supabase/migrations/20261116000020_price_keys_keep_orders.sql:17` — Changes orders.user_id FK to ON DELETE SET NULL so auth.admin.deleteUser(userId) anonymizes orders while cascading user-owned tables containing storage paths.
- `src/features/settings/DataCard.tsx:14` — Client Deleted schema z.object({ deleted: z.literal(true) }) drops filesPending and line 40 proceeds directly to supabase.auth.signOut({ scope: 'local' }).
- `src/data/remote/api.ts:353` — avatarUrl (3600s) at line 353 and receiptUrl (600s) at line 359 mint signed URLs that continue serving undeleted storage objects until expiry after account deletion.
- `supabase/config.toml:166` — Auth jwt_expiry defaults to 3600s while storage.objects RLS policies evaluate auth.uid() from JWT claims without checking auth.users.

**Exact Blockers:**
- Host environment lacks Deno, Docker, and unprivileged user namespaces (apparmor_restrict_unprivileged_userns=1), preventing local execution of Supabase Storage and the delete-account Edge Function.
- Runtime behavior of hosted Supabase Storage list()/remove() on virtual subfolder prefixes, whether Storage/gateway checks auth.users existence for unexpired JWTs (jwt_expiry = 3600s), project-level Storage quotas, Edge Function request timeouts, and any out-of-repo log alerting/cleanup for delete_account_files_pending cannot be observed from source alone.

**Validation Plan:**
- **Local (Bounded Fixture):** In an isolated local Supabase stack (supabase start), create a disposable user, upload <uid>/flat.jpg (image/jpeg) and <uid>/sub/nested.pdf (application/pdf) to receipts and <uid>/sub/stmt.pdf (application/pdf) to statements via the Storage API, capture the user JWT and a 600s signed URL for receipts/<uid>/sub/nested.pdf, call POST /functions/v1/delete-account with {confirm:'DELETE'}, and verify in storage.objects and local Storage API/Edge Function logs whether removeFolder issues 100 list+remove iterations per bucket with virtual folders, whether nested objects survive and remain downloadable via the signed URL, whether the unexpired JWT passes storage.objects RLS for select/insert, and whether simulating a Storage error on receipts leaves statements and avatars untouched while logging delete_account_files_pending.
- **Deployment (Owner-Observed Read-Only):** Owner-observed check on target Supabase without sending audit or mutation traffic: inspect Edge Function logs for delete_account_files_pending records and check whether any out-of-repo automation cleans them up; inspect project Storage quota/retention settings and storage.objects RLS policies in the dashboard/database; and run a read-only check comparing storage.objects prefixes/owner_id against auth.users to observe whether orphaned objects exist.

---

<a id="lead-19"></a>

### 19. In-flight AppStore and feature-provider reloads and pending refs are not invalidated on sign-out, leaking prior user's state and route-guard flags into the next session

- **Fingerprint:** `arshif.state.signout.stale-reload-cross-account-leak`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
src/state/AppStore.tsx fails to bump reloadSeq, verify active userId after await, and clear mutable transaction/sync refs when userId transitions to null; src/state/reducer.ts preserves status === 'ready' across load/start and load/error transitions; and AssetsProvider, InvoicesProvider, and PlanningProvider in src/state/ omit userId/sequence invalidation and likewise preserve status === 'ready'.

**Description:**  
When userId becomes null on sign-out (src/state/AppStore.tsx:156-159), AppStoreProvider dispatches reset and nulls synced.current, but does not increment reloadSeq.current, clear reloading/applying/historyTried/pending/deleting/settledDuringReload/deletedDuringReload/dirtyDuringReload/chains refs, or clear module-level FX/category registries. AppStoreProvider.reload() (src/state/AppStore.tsx:89-150) only checks seq !== reloadSeq.current at line 127 (after already executing module-level FX and theme/language side effects at lines 105-125) and never checks active userId after await. Although api.loadRateHistory (line 111) fails to load/error when oldest !== null and sign-out completes before Promise.all resolves (since anon lacks SELECT on fx_rates per supabase/migrations/20261105000002_rls.sql:16,87), load/done executes with user A's data whenever user A has zero transactions (oldest === null) or signs out after loadRateHistory is dispatched. Furthermore, un-cleared pending/deleting refs and late dispatch() .catch() undoActions(action, before) calls (src/state/AppStore.tsx:247-278, src/state/reducer.ts:173-184) can merge or restore user A's transactions and state slices into user B's session. Because reducer load/start and load/error (src/state/reducer.ts:205,209) preserve status === 'ready', user B signing in bypasses BootScreen, SuspendedScreen, and /setup in Routes (src/app/_layout.tsx:118,132,134,163) and renders user A's accounts and transactions until user B's reload finishes (or persistently on load error). Sibling providers AssetsProvider (src/state/assets.tsx:41-59), InvoicesProvider (src/state/invoices.tsx:39-58), and PlanningProvider (src/state/planning.tsx:67-85) also remain mounted across account switches, lack sequence or post-await userId guards, preserve status === 'ready' across load/error, and begin loading after app.status === 'ready' && app.onboarded while the user can sign out; if stale state sets ready, useNetWorthSnapshot (src/state/netWorth.ts:35-43) can also upsert a stale net-worth snapshot under user B's session (src/state/assets.tsx:86).

**Ordered Trace:**
1. **`entrypoint`** — `src/state/AppStore.tsx:89` (`AppStoreProvider.reload`): Starts async reload() for user A capturing seq = ++reloadSeq.current at line 91 before awaiting Supabase queries at lines 99-111 (or triggers AssetsProvider/InvoicesProvider/PlanningProvider reload after app.status === 'ready').
2. **`propagation`** — `src/state/AppStore.tsx:156` (`AppStoreProvider`): On sign-out (userId becomes null), the else branch calls localDispatch({ type: 'reset' }) at line 158 without incrementing reloadSeq.current or clearing pending, deleting, settledDuringReload, deletedDuringReload, dirtyDuringReload, chains, or historyTried refs.
3. **`propagation`** — `src/state/AppStore.tsx:141` (`AppStoreProvider.reload`): When user A's in-flight reload completes while signed out (with oldest === null or after loadRateHistory was dispatched), seq === reloadSeq.current still holds at line 127 without verifying userId, dispatching load/done with user A's profile, accounts, transactions, and onboarded/suspended flags.
4. **`propagation`** — `src/state/reducer.ts:205` (`reducer`): When user B signs in and triggers reload(), load/start preserves status: 'ready' whenever prior status was 'ready' (and load/error at line 209 likewise keeps 'ready') instead of resetting to 'loading'.
5. **`sink`** — `src/app/_layout.tsx:118` (`Routes`): Evaluates booting as false (line 118) and uses stale state.suspended (line 132) and state.onboarded (line 134) to unlock Stack.Protected (line 163), rendering (tabs) (src/app/(tabs)/index.tsx) with user A's accounts and transactions to user B.

**Verified Source Evidence:**
- `src/state/AppStore.tsx:156` — The else branch for !userId dispatches reset and nulls synced.current without incrementing reloadSeq.current or clearing pending.current, deleting.current, settledDuringReload.current, deletedDuringReload.current, dirtyDuringReload.current, chains.current, or historyTried.current.
- `src/state/AppStore.tsx:127` — Staleness guard checks only seq !== reloadSeq.current without verifying active userId, and runs after module-level FX and preference side effects at lines 105-125.
- `src/state/AppStore.tsx:272` — Failed in-flight dispatch() catch handler runs undoActions(action, before).forEach(localDispatch) and settles pending/deleting refs without checking whether userId changed on sign-out.
- `src/state/reducer.ts:205` — load/start returns status: 'ready' whenever prior status was 'ready' (and load/error at line 209 likewise keeps 'ready'), preventing BootScreen from gating a new account after a stale load/done.
- `src/app/_layout.tsx:118` — Routes derives booting from state.status and gates SuspendedScreen (line 132) and Stack.Protected onboarded routes (lines 134, 163) on state.suspended and state.onboarded without keying AppStoreProvider, AssetsProvider, InvoicesProvider, or PlanningProvider on userId.
- `src/state/assets.tsx:46` — AssetsProvider.reload sets state with status: 'ready' without checking whether userId changed or signed out while api.loadAssets was in flight, and preserves 'ready' in reload start and catch.
- `src/state/invoices.tsx:43` — InvoicesProvider.reload calls setInvoices and setStatus('ready') without sequence or userId checks, and preserves 'ready' in reload start and catch.
- `src/state/planning.tsx:72` — PlanningProvider.reload calls setState with status: 'ready' without sequence or userId checks, and preserves 'ready' in reload start and catch.

**Exact Blockers:**
- Host Linux kernel enforces apparmor_restrict_unprivileged_userns=1 and lacks bwrap, firejail, nsjail, deno, and Docker to execute Jest/React Native Testing Library tests demonstrating the async sign-out/sign-in race.

**Validation Plan:**
- **Local (Bounded Fixture):** Write a bounded Jest unit test wrapping Routes/AppStoreProvider/AssetsProvider/InvoicesProvider/PlanningProvider with a mocked Supabase client and deferred promises: (1) start reload() for dummy user A (onboarded=true, 0 transactions, plus pending Assets/Invoices/Planning loads), transition session to null (signOut), resolve user A's deferred promises, then transition session to dummy user B (with a pending or failing reload, testing onboarded=false and suspended=true) and assert whether user A's accounts/assets/invoices/planning data or onboarded/suspended flags appear on screen; (2) separately dispatch a failing mutation for user A before sign-out and assert whether undoActions or pending/deleting refs leak user A's state into user B's store.

---

<a id="lead-20"></a>

### 20. Backup recovery key, Google Drive OAuth token, and backup/Drive metadata persist across account deletion and sign-out

- **Fingerprint:** `backup/drive-token-and-recovery-key-persist-across-delete-and-signout`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
src/features/backup/service.ts, src/features/backup/driveToken.ts, and src/features/backup/drive.tsx persist arshif.backup.key (SecureStore, native), arshif.drive.token (sessionStorage, web), arshif.drive.history (AsyncStorage/localStorage), and arshif.backup.lastAt/arshif.backup.everyDays (AsyncStorage/localStorage) under global keys without userId scoping or deletion helpers, and neither sign-out/deletion handlers (DataCard.doDelete, PengaturanScreen, SuspendedScreen, AdminWeb) nor SessionProvider.onAuthStateChange purge them (unlike sibling SmartLogProvider and PurchasesBridge).

**Description:**  
Client-side backup credentials and Drive/schedule metadata are persisted under fixed, non-user-scoped keys and are never removed when a user signs out or deletes their account. On native mobile devices (canStoreKey = Platform.OS !== 'web'), SecureStore['arshif.backup.key'] and AsyncStorage['arshif.backup.lastAt'/'arshif.backup.everyDays'/'arshif.drive.history'] survive supabase.auth.signOut(), DataCard.doDelete (delete-account + local sign-out), and app restarts, allowing a subsequent account on the same device to view the prior user's plaintext 256-bit recovery key via KeySheet mode='show', auto-decrypt prior .arshif backups via tryOpen(), import a deleted user's cascaded records via restoreBackup(), and silently encrypt its own new backups under the prior user's key via startCreate(). On web (when EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is configured), sessionStorage['arshif.drive.token'] (drive.file scope) and AsyncStorage/localStorage['arshif.drive.history'/'arshif.backup.lastAt'/'arshif.backup.everyDays'] persist across sign-out and account deletion in the same browser tab (and localStorage history/schedule survive tab closes), allowing a subsequent user on /pengaturan/cadangan to inherit the prior user's active Google Drive session, Google email, Drive backup file list, and upload/download access.

**Ordered Trace:**
1. **`entrypoint`** — `src/features/settings/DataCard.tsx:35` (`DataCard.doDelete`): User A deletes their account via delete-account (line 38) and calls supabase.auth.signOut({ scope: 'local' }) at line 40 without clearing SecureStore, sessionStorage, or AsyncStorage backup or Google Drive keys; PengaturanScreen (src/app/pengaturan/index.tsx:125), SuspendedScreen (src/components/shell/BootScreen.tsx:43), and AdminWeb (src/app/admin.tsx:71,112) sign-out paths likewise call supabase.auth.signOut() without clearing these keys.
2. **`propagation`** — `src/state/session.tsx:19` (`SessionProvider`): onAuthStateChange updates React session state on sign-out or account switch without purging unscoped backup or Drive storage keys, and AppStoreProvider (src/state/AppStore.tsx:156-159) only resets in-memory reducer state, whereas sibling SmartLogProvider (src/state/smartlog.tsx:137-140) removes arshif.smartlog.held and PurchasesBridge (src/state/billing.ts:32) calls forgetPurchaser() on session loss.
3. **`propagation`** — `src/features/backup/driveToken.ts:14` (`loadWebToken`): On web, captureDriveRedirect (called at boot in src/app/_layout.tsx:43) stores the prior user's Google Drive OAuth access token (drive.file scope) under unscoped sessionStorage key 'arshif.drive.token' (line 12, saveWebToken at lines 23-26); when User B signs in within the same browser tab and opens /pengaturan/cadangan, DriveWeb (src/features/backup/drive.tsx:169) initializes from loadWebToken() and restores any unexpired token.
4. **`propagation`** — `src/features/backup/drive.tsx:133` (`useDriveCore`): On mount, useDriveCore unconditionally loads AsyncStorage['arshif.drive.history'] (HISTORY_KEY at line 85, persisted in localStorage on web and AsyncStorage on native and never removed by disconnect/clear at lines 153, 170-173, 198); on web, when DriveWeb provides User A's unexpired token, lines 143-144 query Drive about() and list() to display User A's Google account email and Drive .arshif backups.
5. **`sink`** — `src/app/pengaturan/cadangan.tsx:88` (`Cadangan`): On native, loadStoredKey() (src/features/backup/service.ts:18) reads User A's unscoped 256-bit AES-256-GCM key from SecureStore['arshif.backup.key'] and loadSchedule() (line 87) loads global schedule metadata; Cadangan then exposes the plaintext key via KeySheet mode='show' (lines 245, 323), auto-decrypts .arshif files via tryOpen(p, key) (line 138), and bypasses key setup in startCreate (line 109) to encrypt User B's backups with User A's key, while on web DriveWeb exposes User A's Drive account, file history, and upload/download actions (lines 114, 155, 277, 289).

**Verified Source Evidence:**
- `src/features/backup/service.ts:11` — Defines unscoped SecureStore key KEY_ITEM = 'arshif.backup.key' (native only via canStoreKey = Platform.OS !== 'web' at line 16) and AsyncStorage keys LAST_ITEM = 'arshif.backup.lastAt' and EVERY_ITEM = 'arshif.backup.everyDays' (lines 12-13); storeKey (line 24), loadStoredKey (line 18), saveSchedule (line 87), and loadSchedule (line 77) lack userId binding and any deletion helper.
- `src/features/backup/driveToken.ts:12` — Defines unscoped sessionStorage key TOKEN_KEY = 'arshif.drive.token'; captureDriveRedirect (lines 33-48, invoked at boot in src/app/_layout.tsx:43) saves Drive access tokens via saveWebToken (line 23), and loadWebToken (lines 14-21) returns any unexpired token without verifying Arshif userId.
- `src/features/backup/drive.tsx:85` — Defines unscoped AsyncStorage key HISTORY_KEY = 'arshif.drive.history', loaded on mount at lines 133-137 and not cleared by clear/disconnect (lines 153, 170-173, 198); when activeClientId() is configured (DriveGate, lines 207-211), DriveWeb (line 169) initializes from loadWebToken() and useDriveCore queries Drive about/list (lines 143-144) and exposes upload/download (lines 154-158).
- `src/features/settings/DataCard.tsx:40` — After invoking delete-account (line 38), doDelete calls supabase.auth.signOut({ scope: 'local' }) without deleting SecureStore['arshif.backup.key'], sessionStorage['arshif.drive.token'], or AsyncStorage backup/Drive keys.
- `src/app/pengaturan/index.tsx:125` — Sign-out confirmation invokes supabase.auth.signOut() without purging backup or Drive storage keys, and PengaturanScreen loads global backup schedule state via loadSchedule() at line 39; BootScreen.tsx:43 and admin.tsx:71,112 sign-out actions also omit cleanup.
- `src/app/pengaturan/cadangan.tsx:88` — Cadangan unconditionally loads loadStoredKey() and loadSchedule() (line 87) on mount, displaying the inherited key in KeySheet mode='show' (lines 245, 323), calling tryOpen(p, key) on selected/downloaded .arshif files (line 138), and reusing key in startCreate (line 109) without running KeySheet mode='setup'.
- `src/features/backup/KeySheet.tsx:32` — In mode === 'show', KeySheet formats current (the stored 256-bit key) as a 52-character Crockford Base32 string and displays/shares it in plaintext (lines 33, 36-43, 81-85).
- `src/state/session.tsx:19` — SessionProvider updates React session state on onAuthStateChange without clearing Drive or backup storage keys on sign-out or user ID transition; AppStoreProvider (src/state/AppStore.tsx:156-159) only dispatches an in-memory reducer reset.
- `src/state/smartlog.tsx:137` — Sibling SmartLogProvider explicitly checks (sessionReady && !session) to disable native capture and remove AsyncStorage['arshif.smartlog.held'] (HELD_KEY) so prior-user data does not carry over to another account on the same device.
- `src/lib/backup/data.ts:41` — collectBackup strips user_id from backed-up rows and restoreBackup (lines 97-138, calling restore_rows in supabase/migrations/20261122000026_restore_rows.sql) restores rows under the current auth.uid(), enabling a subsequent user who decrypts a deleted account's .arshif backup (whose server rows cascaded on deletion per supabase/migrations/20261105000001_schema.sql) to restore that data into their own account.

**Exact Blockers:**
- Host Linux kernel enforces apparmor_restrict_unprivileged_userns=1 and lacks bwrap, firejail, nsjail, and Docker isolation, preventing execution of Jest/React Native Testing Library or Playwright runtime checks on SecureStore, AsyncStorage, and sessionStorage.
- Activation of DriveGate (DriveWeb/DriveNative) depends on build-time environment variables (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID, EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID) outside repository source, although arshif.backup.key and arshif.backup.lastAt/arshif.backup.everyDays require no env flags.

**Validation Plan:**
- **Local (Bounded Fixture):** Run a bounded, non-destructive Jest/React Native Testing Library test with dummy User A and User B accounts and mocked expo-secure-store, AsyncStorage, and sessionStorage: (1) on web mode with EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID set, save a dummy unexpired token via saveWebToken(), save dummy DriveFile metadata via AsyncStorage['arshif.drive.history'], invoke DataCard.doDelete (mocked delete-account) or PengaturanScreen signOut, sign in as User B, mount CadanganScreen, and verify loadWebToken() and DriveWeb/useDriveCore inherit User A's token and Drive history; (2) on native mode, call storeKey() and saveSchedule() as User A, invoke signOut(), sign in as User B, render CadanganScreen, and verify loadStoredKey() returns User A's key, KeySheet mode='show' displays it, tryOpen() decrypts a dummy User A .arshif fixture, and startCreate() skips setup and encrypts with User A's key.
- **Deployment (Owner-Observed Read-Only):** In a non-production staging deployment using dedicated dummy test accounts A and B: (1) on staging web with EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID configured, connect Google Drive as test account A on /pengaturan/cadangan, upload a dummy .arshif backup, sign out or delete test account A, sign in as test account B in the same browser tab, open /pengaturan/cadangan, and observe whether account A's Drive connection email, file list, and backup history remain accessible; (2) on a staging native mobile build, create a backup as test account A to store arshif.backup.key, sign out or delete test account A, sign in as test account B on the same device, open Settings > Backup, and observe whether 'Show recovery key' reveals account A's key and creating a backup skips key generation.

---

<a id="lead-21"></a>

### 21. SmartLog CaptureStore queue race, unguarded re-enable, and non-cancellable processNow allow bank notifications to cross logout onto a subsequent user

- **Fingerprint:** `smartlog/logout-race-and-capturestore-queue-leakage`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
CaptureStore.accepts() runs unlocked while append() omits KEY_ENABLED/KEY_PACKAGES re-validation inside LOCK and configure() clears KEY_QUEUE only on disable via async edit.apply() inside a React useEffect, while SmartLogInner.processNow() lacks mount/userId/session guards before calling api.ingest and writing captures/sum.held to AsyncStorage HELD_KEY.

**Description:**  
SmartLogListenerService persists raw unredacted bank notifications (including title/text before JS OTP and balance filtering) into SharedPreferences (arshif_smartlog via CaptureStore), while SmartLogProvider persists held captures in AsyncStorage (arshif.smartlog.held) and processes them via the singleton Supabase client. Source inspection shows multiple logout-isolation gaps on Android/client: (1) SmartLogListenerService.onNotificationPosted calls CaptureStore.accepts(sbn.packageName) outside CaptureStore.LOCK before CaptureStore.append() writes KEY_QUEUE inside LOCK without re-checking KEY_ENABLED or KEY_PACKAGES; meanwhile CaptureStore.configure(false, []) runs asynchronously via React useEffect (not synchronously inside signOut/doDelete), persists via async edit.apply(), and CaptureStore.configure(true, ...) leaves existing KEY_QUEUE intact, allowing a capture racing with sign-out to survive in KEY_QUEUE and be drained when a subsequent user signs in with SmartLog already enabled (whereas if the subsequent user signs in with SmartLog disabled, SmartLogInner calls configure(false, []) at status==='ready' and clears KEY_QUEUE before they can toggle it on). (2) SmartLogProvider wraps SmartLogInner with key={userId ?? 'signed-out'}, so signing out unmounts the prior user's SmartLogInner and mounts the signed-out instance whose useEffect removes HELD_KEY, yet any in-flight processNow() continues running without mount, userId, or session cancellation checks. When remaining api.ingest calls fail post-logout (e.g., 42501 unauthorized after session removal) or hit quota, processCaptures pushes them into out.held and processNow() unconditionally overwrites AsyncStorage HELD_KEY via saveHeld(captures) / saveHeld(sum.held) after cleanup already ran (or calls api.ingest on the singleton supabase client if another user signs in mid-loop). A subsequent user on the device who already has SmartLog enabled drains both KEY_QUEUE and HELD_KEY (and one who enables SmartLog after sign-in still reads HELD_KEY), ingesting the prior user's captures via smartlog_ingest into their own smartlog_items and transactions ledger.

**Ordered Trace:**
1. **`entrypoint`** — `modules/smart-log/android/src/main/java/expo/modules/smartlog/SmartLogListenerService.kt:14` (`SmartLogListenerService.onNotificationPosted`): Reads store.accepts(sbn.packageName) without acquiring CaptureStore.LOCK, constructs a raw notification JSONObject with unredacted title (up to 200 chars) and text (up to 1000 chars) at lines 23-28, and passes it to store.append(capture) at line 29.
2. **`propagation`** — `modules/smart-log/android/src/main/java/expo/modules/smartlog/CaptureStore.kt:26` (`CaptureStore.append`): Acquires LOCK at line 27 and commits the capture to KEY_QUEUE without re-checking KEY_ENABLED or KEY_PACKAGES; configure() (lines 14-20) only removes KEY_QUEUE when !enabled (preserving KEY_QUEUE when configure(true, ...) runs for a subsequent user) and uses async edit.apply().
3. **`propagation`** — `src/state/smartlog.tsx:136` (`SmartLogInner`): Logout cleanup (configure(false, []) and AsyncStorage.removeItem(HELD_KEY)) executes only asynchronously inside a React useEffect when sessionReady && !session (lines 136-141) rather than synchronously on sign-out, while an in-flight processNow() in the unmounting user instance keeps awaiting readHeld() (line 201) and processCaptures(captures, api.ingest) (line 209) with no cancellation or active-user check.
4. **`sink`** — `src/state/smartlog.tsx:210` (`SmartLogInner.processNow`): Unconditionally persists sum.held back into AsyncStorage HELD_KEY (and captures at line 208) after sign-out cleanup already removed HELD_KEY; when a subsequent user logs into the same app session with SmartLog enabled, SmartLogInner calls drainNative() and readHeld() (lines 200-201, 244) and submits the prior user's captures to public.smartlog_ingest under the new user's session.

**Verified Source Evidence:**
- `modules/smart-log/android/src/main/java/expo/modules/smartlog/SmartLogListenerService.kt:14` — store.accepts(sbn.packageName) is called outside LOCK before building the raw notification JSONObject (lines 23-28) and invoking store.append(capture) at line 29.
- `modules/smart-log/android/src/main/java/expo/modules/smartlog/CaptureStore.kt:17` — configure() clears KEY_QUEUE only when !enabled and calls edit.apply(), while accepts() (lines 22-23) is unlocked and append() (lines 26-40) never checks KEY_ENABLED or KEY_PACKAGES inside synchronized(LOCK).
- `src/state/smartlog.tsx:136` — Cleanup runs in a useEffect on the newly mounted SmartLogInner('signed-out') instance, while processNow() (lines 196-227) in the unmounted instance saves captures at line 208 and sum.held at line 210 without checking mount status, active userId, or session.
- `src/state/smartlog.tsx:147` — SmartLogInner calls SmartLogNative?.configure(data.enabled, ...) once status === 'ready', clearing KEY_QUEUE only when data.enabled is false and leaving KEY_QUEUE intact when true without clearing HELD_KEY.
- `src/lib/smartlog/process.ts:47` — When api.ingest throws (e.g., RPC rejected after sign-out clears the JWT) or hits quota (lines 52-55), processCaptures pushes remaining captures into out.held.
- `src/data/remote/smartlog.ts:98` — api.ingest calls supabase.rpc('smartlog_ingest', ...) via the singleton Supabase client and fail() throws on error, causing post-signout ingest calls to land in out.held (or execute under a newly logged-in user's JWT).
- `src/app/pengaturan/index.tsx:125` — User sign-out invokes supabase.auth.signOut() without synchronously stopping CaptureStore or clearing HELD_KEY.
- `src/features/settings/DataCard.tsx:40` — Account deletion invokes delete-account and supabase.auth.signOut({ scope: 'local' }) without synchronously clearing CaptureStore or HELD_KEY.
- `src/components/shell/BootScreen.tsx:43` — SuspendedScreen sign-out invokes supabase.auth.signOut() without synchronously clearing CaptureStore or HELD_KEY.
- `supabase/migrations/20261109000010_smartlog.sql:68` — public.smartlog_ingest keys smartlog_items uniqueness by (auth.uid(), capture_key) and inserts into smartlog_items / transactions for the currently authenticated user without any cross-device-user provenance binding.

**Exact Blockers:**
- Host Linux kernel enforces apparmor_restrict_unprivileged_userns=1 and lacks bwrap, firejail, nsjail, deno, JDK, and Android SDK, preventing execution of Jest tests for SmartLogProvider and preventing Android compilation/emulator testing of concurrent SmartLogListenerService.onNotificationPosted + CaptureStore.configure(false, []).

**Validation Plan:**
- **Local (Bounded Fixture):** In an isolated Jest test of SmartLogProvider using the async-storage mock and mocked SmartLogNative/api.ingest, start processNow() for dummy User A with a deferred api.ingest promise, trigger signOut (session -> null so SmartLogInner('signed-out') removes HELD_KEY), reject the deferred api.ingest call, verify saveHeld(sum.held) repopulates HELD_KEY, and sign in as dummy User B with SmartLog enabled to verify User A's dummy capture is ingested via api.ingest under User B; additionally, in an isolated Android emulator test build, race concurrent SmartLogListenerService.onNotificationPosted against CaptureStore.configure(false, []) followed by configure(true, ...) to observe KEY_QUEUE retention across logout/login.

---

## Client WebView, Supply Chain & Mobile OTA Release Security

<a id="lead-22"></a>

### 22. PriceChart web srcDoc iframe grants allow-same-origin alongside allow-scripts to external TradingView widget

- **Fingerprint:** `arshif.client.pricechart.srcdoc-same-origin-sandbox`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
src/features/assets/PriceChart.web.tsx sets both allow-scripts and allow-same-origin on a srcDoc iframe loading an external third-party script (https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js) without CSP script-src or sandbox isolation in vercel.json.

**Description:**  
On web, PriceChart renders TradingView's external embed script inside an <iframe srcDoc> with sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox", while vercel.json sets Content-Security-Policy to frame-ancestors 'none' only. Because srcDoc inherits the parent origin unless isolated into an opaque origin and allow-same-origin is combined with allow-scripts, any script executing in the chart iframe runs same-origin with the parent Arshif app and can read localStorage Supabase tokens and sessionStorage Google Drive tokens, mutate the parent DOM, or access window.frameElement.

**Ordered Trace:**
1. **`entrypoint`** — `src/features/assets/chartHtml.ts:61` (`chartHtml`): Embeds external unpinned third-party script https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js (WIDGET_SRC at line 13) into the generated HTML document.
2. **`propagation`** — `src/features/assets/PriceChart.web.tsx:42` (`PriceChart`): Passes the chartHtml() document containing the external TradingView script into the <iframe srcDoc> prop when mounted from AssetDetail (src/app/aset/[id].tsx:111).
3. **`propagation`** — `vercel.json:8` (`headers`): Sets Content-Security-Policy to frame-ancestors 'none' only across /(.*), providing no script-src or sandbox directive to restrict scripts or srcDoc frame privileges.
4. **`sink`** — `src/features/assets/PriceChart.web.tsx:44` (`PriceChart`): Mounts the same-origin srcDoc iframe with sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox", granting scripts executed by the external TradingView embed same-origin access to window.parent.document, localStorage Supabase session tokens, sessionStorage Drive tokens, and window.frameElement.

**Verified Source Evidence:**
- `src/features/assets/PriceChart.web.tsx:44` — Renders <iframe srcDoc={...} sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox">, contradicting the comment on line 43 that the app page cannot be navigated from the chart.
- `src/features/assets/chartHtml.ts:13` — Defines WIDGET_SRC as https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js, which is loaded without SRI via <script src> in the srcDoc body at line 61.
- `src/app/aset/[id].tsx:111` — AssetDetail renders PriceChart for any live or gold asset when chartSymbol(asset) returns non-null under the authenticated web route aset/[id] (src/app/_layout.tsx:209).
- `vercel.json:8` — Configures Content-Security-Policy: frame-ancestors 'none' only on /(.*); no script-src or sandbox CSP directive exists in vercel.json or static HTML templates.
- `src/lib/supabase.ts:16` — Persists the Supabase session via AsyncStorage on web (backed by window.localStorage per src/theme/ThemeProvider.tsx:33 and scripts/e2e-web.mjs:40) on the parent origin.
- `src/features/backup/driveToken.ts:25` — Stores the web Google Drive OAuth access token in same-origin sessionStorage under arshif.drive.token.

**Exact Blockers:**
- Host kernel enforces apparmor_restrict_unprivileged_userns=1 and lacks browser/Playwright sandbox isolation to execute PriceChart.web.tsx at runtime, observe iframe access to window.parent.localStorage/sessionStorage/frameElement, and test whether TradingView's embed-widget-symbol-overview.js renders under an opaque origin (without allow-same-origin).
- Live Vercel HTTP response headers are outside repository source control and must be inspected to verify that no platform- or edge-injected Content-Security-Policy script-src or sandbox header overrides vercel.json.

**Validation Plan:**
- **Local (Bounded Fixture):** Mount PriceChart.web.tsx in a local browser test with a stubbed script served at WIDGET_SRC and verify whether script inside the srcDoc iframe can read window.parent.localStorage/sessionStorage or access window.frameElement/window.parent.document; also verify whether TradingView embed-widget-symbol-overview.js renders when allow-same-origin is removed or when hosted on an isolated origin.
- **Deployment (Owner-Observed Read-Only):** Inspect the deployed Vercel web app HTTP response headers for Content-Security-Policy on / and /aset/<id> to verify whether only frame-ancestors 'none' is served, and verify live TradingView widget compatibility under opaque-origin sandboxing.

---

<a id="lead-23"></a>

### 23. Expo OTA updates enabled on load without codeSigningCertificate or codeSigningMetadata verification

- **Fingerprint:** `release/expo-updates-missing-code-signing`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
app.json:89-96 enables automatic OTA JavaScript updates via expo-updates (~58.0.21) without configuring updates.codeSigningCertificate or updates.codeSigningMetadata (and no app.config.* override or build-time signing hook exists in the repository).

**Description:**  
app.json enables expo-updates (~58.0.21) with checkAutomatically set to 'ON_LOAD' (fallbackToCacheTimeout: 0, runtimeVersion.policy: 'fingerprint') against https://u.expo.dev/cb2a9ff2-2ae6-40f2-87cd-cd6b4707116d across all eas.json build channels ('development', 'preview', 'production'), without configuring updates.codeSigningCertificate or updates.codeSigningMetadata and with no app.config.* override or EAS build lifecycle hook in the repository. Inspection of the pinned expo-updates (58.0.21) and @expo/config-plugins (58.0.12) packages confirms that when these fields are omitted, native prebuild removes/omits code-signing metadata from AndroidManifest.xml and Expo.plist, and both Android and iOS clients omit expo-expect-signature and skip signature verification on update manifests and directives. Because fallbackToCacheTimeout is 0, remote updates are fetched asynchronously in the background on launch and executed on subsequent launch or error-recovery relaunch; without E2E code signing, native builds trust EAS account/CDN integrity and HTTPS transport CAs alone, so a compromised EAS publishing token/origin or trusted TLS MITM can execute arbitrary JS inside the native runtime with access to SecureStore backup recovery keys, AsyncStorage Supabase sessions, and Smart Log notification captures.

**Ordered Trace:**
1. **`entrypoint`** — `app.json:92` (`expo.updates`): Configures remote OTA updates from 'https://u.expo.dev/cb2a9ff2-2ae6-40f2-87cd-cd6b4707116d' with checkAutomatically: 'ON_LOAD', fallbackToCacheTimeout: 0, and runtimeVersion.policy: 'fingerprint' (lines 89-96) while omitting codeSigningCertificate and codeSigningMetadata, trusting any manifest and JS bundle served from the remote update origin or via a trusted TLS MITM.
2. **`propagation`** — `eas.json:7` (`build`): Defines 'development' (developmentClient: true), 'preview', and 'production' build profiles/channels (lines 7-25) consuming app.json and package.json:35 ('expo-updates': '~58.0.21') with no app.config.* override or code-signing env injection. During prebuild, @expo/prebuild-config auto-applies expo-updates and omits Android/iOS code-signing metadata, leaving codeSigningConfiguration null/nil in native Android and iOS clients so remote updates are downloaded on launch without signature verification.
3. **`sink`** — `src/features/backup/service.ts:20` (`Native JS runtime secret storage`): When the staged unsigned JS bundle executes on subsequent launch or error-recovery relaunch, it runs with full access to SecureStore AES-256-GCM backup recovery keys (src/features/backup/service.ts:20), Supabase session tokens in AsyncStorage (src/lib/supabase.ts:16), and Android banking notification captures drained via SmartLogNative.drain() (src/state/smartlog.tsx:71).

**Verified Source Evidence:**
- `app.json:89` — Sets owner 'fakeriz152s-team' (line 88), runtimeVersion policy 'fingerprint' (lines 89-91), and updates url 'https://u.expo.dev/cb2a9ff2-2ae6-40f2-87cd-cd6b4707116d' with checkAutomatically 'ON_LOAD' and fallbackToCacheTimeout 0 (lines 92-96) without codeSigningCertificate or codeSigningMetadata, and plugins (lines 39-72) configure no signing override.
- `eas.json:7` — Defines development (lines 7-14), preview (lines 15-21), and production (lines 22-25) channels with no code-signing certificate configuration or environment overrides.
- `package.json:35` — Includes 'expo-updates': '~58.0.21' in production dependencies (alongside 'expo-secure-store': '~58.0.3' at line 30 and '@react-native-async-storage/async-storage': '2.2.0' at line 8) with no eas-build-* lifecycle hooks in scripts (lines 63-79).
- `node_modules/@expo/config-plugins/build/utils/Updates.js:326` — getUpdatesCodeSigningCertificate (lines 326-336) and getUpdatesCodeSigningMetadata (lines 337-339) return undefined when omitted; android/Updates.js (lines 125-136) and ios/Updates.js (lines 105-116) remove CODE_SIGNING_CERTIFICATE and EXUpdatesCodeSigningCertificate from native manifests when unset, and @expo/prebuild-config/build/plugins/withDefaultPlugins.js (lines 156, 162-173) applies this plugin automatically.
- `node_modules/expo-updates/android/src/main/java/expo/modules/updates/loader/FileDownloader.kt:947` — In expo-updates 58.0.21 (Android FileDownloader.kt:656,947,1041 and UpdatesConfiguration.kt:144-148; iOS FileDownloader.swift:496,996,1121 and UpdatesConfig.swift:300-313), when codeSigningConfiguration is null/nil the client omits expo-expect-signature and skips manifest/directive signature checks, allowing LoaderTask.kt (162-204,321-417) and AppLoaderTask.swift (154-208,338-464) to stage unsigned remote updates.
- `src/features/backup/service.ts:20` — Reads persisted AES-256-GCM backup recovery key material via SecureStore.getItemAsync('arshif.backup.key') on native builds (Platform.OS !== 'web').
- `src/lib/supabase.ts:16` — Persists authenticated Supabase user session tokens in AsyncStorage on native platforms.
- `src/state/smartlog.tsx:71` — Drains captured Android banking notification payloads from native storage via SmartLogNative.drain() into the OTA-updatable JS context.

**Exact Blockers:**
- Host OS enforces apparmor_restrict_unprivileged_userns=1 and lacks bwrap, firejail, nsjail, EAS CLI, JDK/Android SDK, and Xcode, preventing local Expo native prebuild/manifest inspection and offline update-verification fixture tests.
- Hosted EAS project configuration, channel promotion/deployment access controls, and any external CI build-time injection of updates.codeSigningCertificate / updates.codeSigningMetadata for project cb2a9ff2-2ae6-40f2-87cd-cd6b4707116d (owner fakeriz152s-team) are outside the repository.

**Validation Plan:**
- **Local (Bounded Fixture):** In an offline local Expo build environment without production credentials, run Expo prebuild/config resolution on app.json to confirm AndroidManifest.xml omits expo.modules.updates.CODE_SIGNING_CERTIFICATE and Expo.plist omits EXUpdatesCodeSigningCertificate, and test against a local mock update manifest server serving a harmless fixture JS bundle without an expo-signature header to verify the client accepts and stages the unsigned bundle.
- **Deployment (Owner-Observed Read-Only):** Owner should inspect external CI/EAS build pipelines and EAS project cb2a9ff2-2ae6-40f2-87cd-cd6b4707116d (owner fakeriz152s-team) to confirm whether E2E code-signing certificates are injected at build time for preview/production channels, verify whether any shipped binaries lack embedded signing certificates, and review EAS publish token, 2FA, and channel protection controls.

---

<a id="lead-24"></a>

### 24. Unpinned third-party CDN scripts loaded without SRI or script-src CSP in authenticated web origin and allow-same-origin srcDoc iframe

- **Fingerprint:** `supply-chain/unpinned-third-party-runtime-scripts`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
src/lib/paddle.web.ts:9,21-29 and src/features/assets/chartHtml.ts:13,61 inject mutable, unversioned remote CDN scripts without SRI integrity attributes, paired with allow-same-origin srcDoc iframe execution in src/features/assets/PriceChart.web.tsx:44 and no script-src CSP in vercel.json:8.

**Description:**  
The web client dynamically loads floating third-party CDN scripts without Subresource Integrity (SRI) or script-src Content-Security-Policy enforcement. During USD web checkout (src/app/premium/index.tsx:125, src/app/premium/order/[id].tsx:190), src/lib/paddle.web.ts:9,21-29 injects unversioned https://cdn.paddle.com/paddle/v2/paddle.js directly into document.head without script.integrity (gated only by build-time EXPO_PUBLIC_PADDLE_CLIENT_TOKEN at line 36). Unconditionally on live asset detail pages (src/app/aset/[id].tsx:52,111), src/features/assets/chartHtml.ts:13,61 emits <script type="text/javascript" src="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js" async onerror="tvFail()"> without integrity inside a srcDoc iframe configured with sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" (src/features/assets/PriceChart.web.tsx:39-44) and inside native WebView with originWhitelist={['*']} (src/features/assets/PriceChart.tsx:63-66). Because vercel.json:8 specifies only frame-ancestors 'none' with no script-src policy and allow-same-origin on a srcDoc iframe shares the parent web origin, any upstream compromise or malicious update to either CDN script executes arbitrary JavaScript in the authenticated origin with direct access to Supabase Auth tokens in AsyncStorage/localStorage (src/lib/supabase.ts:16) and Google Drive OAuth tokens in sessionStorage (src/features/backup/driveToken.ts:12,25).

**Ordered Trace:**
1. **`entrypoint`** — `src/lib/paddle.web.ts:9` (`SRC / WIDGET_SRC`): Hardcodes floating unpinned third-party CDN script URL 'https://cdn.paddle.com/paddle/v2/paddle.js' (src/lib/paddle.web.ts:9), parallel to floating 'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js' (src/features/assets/chartHtml.ts:13).
2. **`propagation`** — `src/lib/paddle.web.ts:21` (`load (paddle.web.ts) & chartHtml (chartHtml.ts)`): load() creates a <script> tag with script.src = SRC and appends it to document.head without script.integrity or crossOrigin (src/lib/paddle.web.ts:21-29) when invoked by openPaddleCheckout() (line 35, called from src/app/premium/index.tsx:125 and src/app/premium/order/[id].tsx:190); in parallel, src/app/aset/[id].tsx:111 renders PriceChart which calls chartHtml() (src/features/assets/chartHtml.ts:26,61) to emit <script type="text/javascript" src="${WIDGET_SRC}" async onerror="tvFail()"> without integrity.
3. **`propagation`** — `vercel.json:8` (`headers (Content-Security-Policy)`): vercel.json:7-9 configures only X-Frame-Options: DENY and Content-Security-Policy: frame-ancestors 'none', with no script-src allowlist, nonce, or hash restriction on top-level or srcDoc scripts.
4. **`sink`** — `src/features/assets/PriceChart.web.tsx:44` (`Authenticated top-level DOM & allow-same-origin srcDoc iframe`): paddle.web.ts:29 executes Paddle.js directly in the top-level authenticated web origin, while PriceChart.web.tsx:39-44 executes TradingView's script inside a srcDoc iframe with sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" (and PriceChart.tsx:63-66 inside native WebView), giving loaded scripts same-origin access to parent DOM, localStorage Supabase session tokens (src/lib/supabase.ts:16), and sessionStorage Drive tokens (src/features/backup/driveToken.ts:12,25).

**Verified Source Evidence:**
- `src/lib/paddle.web.ts:9` — Defines unpinned floating v2 CDN script URL https://cdn.paddle.com/paddle/v2/paddle.js.
- `src/lib/paddle.web.ts:21` — Creates a <script> element (lines 21-29) with script.src = SRC and appends it to document.head without script.integrity or crossOrigin SRI verification; gated only by EXPO_PUBLIC_PADDLE_CLIENT_TOKEN in openPaddleCheckout (line 36).
- `src/features/assets/chartHtml.ts:13` — Defines unpinned TradingView widget script URL https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js and injects it via <script> at line 61 without an integrity attribute.
- `src/features/assets/PriceChart.web.tsx:44` — Renders chartHtml() in a srcDoc iframe (lines 39-44) with sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox", sharing the parent web origin with the embedded widget script.
- `src/features/assets/PriceChart.tsx:64` — Renders chartHtml() inside a native react-native-webview WebView (lines 63-66) with originWhitelist={['*']}, loading the unpinned widget script without SRI.
- `src/app/aset/[id].tsx:111` — Renders PriceChart unconditionally for any live-priced asset with a non-null chartSymbol(asset) (lines 52, 107-117), reaching chartHtml() with no env flag gate.
- `src/app/premium/index.tsx:125` — Invokes openPaddleCheckout() on web for USD checkout (lines 50, 124-126), paired with pending order retry in src/app/premium/order/[id].tsx:190.
- `vercel.json:8` — Content-Security-Policy header (lines 7-9) sets only frame-ancestors 'none' and omits script-src.
- `src/lib/supabase.ts:16` — Persists Supabase Auth sessions via AsyncStorage (backed by window.localStorage on web, as also used in scripts/e2e-live.mjs:110 and scripts/e2e-web.mjs:40) in the same browser origin.
- `src/features/backup/driveToken.ts:25` — Persists Google Drive OAuth access tokens (arshif.drive.token, line 12) in window.sessionStorage within the same browser origin.

**Exact Blockers:**
- Host OS enforces apparmor_restrict_unprivileged_userns=1 and lacks bwrap, firejail, nsjail, Docker, and an isolated browser harness to export the web bundle and test script loading without SRI rejection or cross-frame storage reads against a local mock CDN.
- Out-of-repo deployment facts are not observable from repository files: (1) whether Vercel edge/project configuration for arshifstudio adds a Content-Security-Policy script-src header beyond vercel.json:8, (2) whether EXPO_PUBLIC_PADDLE_CLIENT_TOKEN (checked in src/lib/paddle.web.ts:36) and server Paddle secrets are configured in production, and (3) upstream cdn.paddle.com / s3.tradingview.com CDN mutability and caching controls.

**Validation Plan:**
- **Local (Bounded Fixture):** In an isolated, network-disabled OS-sandboxed browser harness serving a locally exported web bundle (npx expo export -p web with a dummy EXPO_PUBLIC_PADDLE_CLIENT_TOKEN), intercept requests to cdn.paddle.com and s3.tradingview.com with harmless local marker scripts and dummy localStorage/sessionStorage token entries to confirm both scripts load without SRI or CSP rejection and that the marker inside PriceChart.web.tsx's allow-same-origin srcDoc iframe can read parent-origin storage.
- **Deployment (Owner-Observed Read-Only):** Owner should inspect HTTP response headers on the live deployed Vercel web app (docs/fase8-admin.md) to verify whether any out-of-repo Content-Security-Policy script-src directive is injected beyond vercel.json:8, check Vercel build environment settings for EXPO_PUBLIC_PADDLE_CLIENT_TOKEN (and Supabase secrets for Paddle), and verify upstream cdn.paddle.com and s3.tradingview.com script mutability and SRI/version-pinning availability.

---

<a id="lead-25"></a>

### 25. Un-allowlisted Linking.openURL scheme dispatch and subframe/data-URI navigation bypass in native PriceChart WebView

- **Fingerprint:** `webview-origin-escape-unallowlisted-linking-openurl:src/features/assets/PriceChart.tsx`
- **Verdict:** `needs_validation` *(no severity assigned pending validation)*

**Claimed Root Cause:**  
PriceChart.tsx sets originWhitelist={['*']} and omits onOpenWindow while its onShouldStartLoadWithRequest guard permits arbitrary data: and isTopFrame === false navigations and forwards all remaining URLs—without http/https scheme allowlisting or user-gesture (navigationType === 'click') verification—directly to Linking.openURL(req.url).

**Description:**  
On native iOS and Android, PriceChart renders a react-native-webview loading local HTML (about:blank) that executes TradingView's external script (https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js) directly in the top-level document and embeds remote iframes without a sandbox attribute (unlike PriceChart.web.tsx, which omits allow-top-navigation). PriceChart sets originWhitelist={['*']}, bypassing WebViewShared.tsx's default ['http://*', 'https://*'] origin check so all URI schemes enter onShouldStartLoadWithRequest={guard}, and omits onOpenWindow (causing iOS target="_blank"/window.open navigations to fall back to [webView loadRequest:navigationAction.request] in RNCWebViewImpl.m and re-enter as top-frame loads). Inside guard, PriceChart: (1) permits arbitrary top-frame data:* navigations; (2) passes through all subframe navigations when req.isTopFrame === false (effective on iOS via RNCWebViewImpl.m, while Android RNCWebViewClient omits isTopFrame so subframe requests entering shouldOverrideUrlLoading fall through); and (3) dispatches any remaining URL to Linking.openURL(req.url) without restricting to https:/http: schemes, checking destination host, requiring navigationType === 'click', or calling Linking.canOpenURL. Remote or compromised TradingView embed/subframe content—or an external origin reached inside an iOS subframe navigating top.location—can therefore trigger OS/third-party URI schemes (e.g., tel:, sms:, mailto:, market://, installed app custom schemes via Android Intent.ACTION_VIEW without CATEGORY_BROWSABLE or iOS UIApplication.openURL) or redirect signed-in users to arbitrary internal arshif:// routes without user confirmation (though web OAuth redirect capture and mount-time destructive actions are gated on native).

**Ordered Trace:**
1. **`entrypoint`** — `src/app/aset/[id].tsx:111` (`AssetDetail`): Renders native PriceChart when an asset has a live TradingView chartSymbol (IDX stock, US stock, non-stablecoin crypto, or gold).
2. **`propagation`** — `src/features/assets/chartHtml.ts:61` (`chartHtml`): Embeds external script https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js directly inside the top-level about:blank HTML document without CSP or iframe sandboxing, executing remote JS in the main WebView frame and spawning TradingView iframes.
3. **`propagation`** — `src/features/assets/PriceChart.tsx:65` (`PriceChart`): Configures WebView with originWhitelist={['*']} (bypassing WebViewShared.tsx defaultOriginWhitelist ['http://*', 'https://*'] so every URI scheme routes to guard) and omits onOpenWindow (causing iOS _blank/window.open popups to fall back to main-frame loadRequest in RNCWebViewImpl.m:400).
4. **`propagation`** — `src/features/assets/PriceChart.tsx:47` (`PriceChart.guard`): Permits top-frame data:* navigations and (on iOS where RNCWebViewImpl.m:1362,1412 sets isTopFrame) arbitrary subframe origins via req.isTopFrame === false; on Android RNCWebViewClient.java:304 omits isTopFrame so subframe requests entering shouldOverrideUrlLoading fall through to line 48.
5. **`sink`** — `src/features/assets/PriceChart.tsx:48` (`PriceChart.guard`): Dispatches any non-about:blank, non-data: URL to Linking.openURL(req.url) without scheme allowlisting, host check, navigationType === 'click' gesture validation, or Linking.canOpenURL, invoking Android IntentModule.openURL (Intent.ACTION_VIEW via Uri.parse without CATEGORY_BROWSABLE at IntentModule.kt:124) or iOS RCTLinkingManager.openURL ([RCTSharedApplication() openURL:...] at RCTLinkingManager.mm:147), including Arshif's arshif:// scheme (app.json:8, expo-router linking.js:178).

**Verified Source Evidence:**
- `src/features/assets/PriceChart.tsx:47` — guard permits about:blank, arbitrary data:* URLs, and req.isTopFrame === false without origin or scheme validation.
- `src/features/assets/PriceChart.tsx:48` — Calls Linking.openURL(req.url) for all remaining URLs without restricting to https:/http:, checking navigationType === 'click', or calling Linking.canOpenURL.
- `src/features/assets/PriceChart.tsx:65` — WebView passes originWhitelist={['*']} and omits onOpenWindow.
- `src/features/assets/chartHtml.ts:13` — WIDGET_SRC loads remote TradingView embed script https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js directly into the top-level document (line 61).
- `src/features/assets/PriceChart.web.tsx:44` — Web counterpart applies iframe sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" to prevent top-frame navigation from the TradingView embed, highlighting missing containment on native.
- `app.json:8` — Registers custom deep-link scheme "arshif" handled by Expo Router Linking listener (node_modules/expo-router/build/link/linking.js:178) via @expo/config-plugins android/ios Scheme.js.
- `node_modules/react-native-webview/src/WebViewShared.tsx:47` — originWhitelist={['*']} causes passesWhitelist to match every scheme, routing non-http(s) schemes into onShouldStartLoadWithRequest instead of defaultOriginWhitelist (line 20).
- `node_modules/react-native-webview/android/src/main/java/com/reactnativecommunity/webview/RNCWebViewClient.java:304` — createWebViewEvent omits isTopFrame and navigationType on Android, causing req.isTopFrame === false in PriceChart.tsx to evaluate false on Android.
- `node_modules/react-native-webview/apple/RNCWebViewImpl.m:400` — When _onOpenWindow is nil, createWebViewWithConfiguration falls back to [webView loadRequest:navigationAction.request], re-entering decidePolicyForNavigationAction where isTopFrame is computed at line 1362.
- `node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/modules/intent/IntentModule.kt:124` — Android openURL creates Intent(Intent.ACTION_VIEW, Uri.parse(url).normalizeScheme()) without Intent.CATEGORY_BROWSABLE and starts the resolved Activity via sendOSIntent (line 125).
- `node_modules/react-native/Libraries/LinkingIOS/RCTLinkingManager.mm:147` — iOS openURL invokes [RCTSharedApplication() openURL:URL options:@{} ...] to dispatch external URI schemes or route arshif:// back into RCTLinkingManager.

**Exact Blockers:**
- Host sandbox disables target code and emulator execution (apparmor_restrict_unprivileged_userns=1, no bwrap/firejail/nsjail/Docker), so WebView navigation interception and Linking.openURL dispatch could not be executed dynamically.
- Native android/ and ios/ projects are generated at EAS/Expo prebuild time and excluded from the repository (tsconfig.json:29-30), so the final AndroidManifest.xml <intent-filter>/<queries> and iOS Info.plist CFBundleURLTypes/LSApplicationQueriesSchemes are not directly observable in source.
- Reachability from normal TradingView widget usage vs compromised embed script or TLS/network proxy, whether Android WebViewClient.shouldOverrideUrlLoading fires on TradingView iframe loads (where isTopFrame is undefined), and OS consent prompt behavior for tel:/sms:/third-party/arshif:// schemes require emulator/device verification.

**Validation Plan:**
- **Local (Bounded Fixture):** In a sandboxed Android emulator and iOS Simulator dev build (with RNCWebViewModule present and a dummy user account), inspect the prebuilt AndroidManifest.xml and Info.plist, then load PriceChart with a local offline HTML/script test harness simulating (a) top-frame navigation to data:text/html,<script>top.location='tel:+15550100'</script>, (b) subframe navigation inside an iframe to a local non-TradingView origin invoking top.location='arshif://pengaturan/data', and (c) <a target='_blank' href='sms:5550100'> and programmatic window.location='sms:5550100' without user click; verify whether OS scheme handlers or Expo Router deep links trigger without user prompt/click gesture and whether Android shouldOverrideUrlLoading fires on iframe loads where isTopFrame is undefined.
- **Deployment (Owner-Observed Read-Only):** Inspect the EAS-prebuild generated AndroidManifest.xml (<intent-filter> and <queries>) and Info.plist (CFBundleURLTypes and LSApplicationQueriesSchemes) artifacts to confirm registered custom schemes (including arshif://) and queryable external URI schemes, and observe in a non-production staging native build (with an owned test account, without sending attack traffic) what navigation URLs and iframe loads TradingView's live embed triggers through PriceChart's onShouldStartLoadWithRequest guard on iOS and Android.

---
