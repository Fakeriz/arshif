-- ============================================================================
-- MIGRASI 008: kunci privasi view coach_draft_funnel (security_invoker).
-- ----------------------------------------------------------------------------
-- Sudah diterapkan ke prod via MCP (008_coach_funnel_security_invoker).
-- Tanpa flag ini view berjalan sebagai pembuatnya dan bisa membocorkan
-- agregat milik user lain; dengan flag ini RLS coach_draft_events berlaku.
-- Idempoten.
-- ============================================================================

alter view public.coach_draft_funnel set (security_invoker = true);
