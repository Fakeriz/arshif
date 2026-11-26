# Confirmed Findings Detail

> **Target:** `arshif` (`72818060cbb72c5d9e8fe677a0f44e0ee23a26a2`, worktree clean: `true`)  
> **Run ID:** `arshif-run-1` | **Profile:** `standard` | **Status:** `complete`  
> **Schema Validation:** `findings.json` (`26` records valid), `coverage-ledger.json` (`20` units valid)

## Execution Boundary & Zero-Confirmed Explanation

Per the audit confirmation contract (`SKILL.md` and `VALIDATION-AND-REPORTING.md`), no candidate may receive verdict `confirmed` or a severity rating (`critical`/`high`/`medium`/`low`) without empirical execution evidence (`execution.command` + factual `observed_result`) in a bounded local harness or an observed runtime/policy violation.

During this run on the current host environment:
- **Target code execution was disallowed and blocked (`sandboxed-source-and-local-only`)**: the host Linux kernel enforces `kernel.apparmor_restrict_unprivileged_userns=1` and lacks `bwrap`, `firejail`, `nsjail`, Docker, `deno`, Android SDK, and Xcode isolation containers, so zero target tests, Postgres/PGlite scripts, Deno Edge Functions, Metro/Expo web bundles, or native mobile emulators were executed.
- **External deployment/runtime controls reside outside the repository**: hosted Supabase secrets, GoTrue `GET /auth/v1/user` and `PUT /user` runtime behavior, Vercel response headers/env vars, third-party CDN behavior, and Xendit/Paddle webhook delivery timing cannot be inspected in offline repository source.

## Confirmed Medium / High / Critical Records (`0`)

| Severity | Fingerprint | Title | Observed Execution Result |
|---|---|---|---|
| *(none)* | — | **0 confirmed vulnerabilities in source-only pass** | Blocked by host sandbox execution constraints and external deployment visibility; 25 independently verified leads require bounded validation. |

All **25 unrefuted `needs_validation` leads** (plus trace, evidence, exact blockers, and bounded validation plans) are documented in full in [NEEDS-VALIDATION.md](./NEEDS-VALIDATION.md) and summarized without severity in [REPORT.md](./REPORT.md).
