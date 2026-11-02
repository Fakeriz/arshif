-- ============================================================================
-- MIGRASI 007: view coach_draft_funnel - ringkasan adopsi draft per user.
-- ----------------------------------------------------------------------------
-- CARA PAKAI: sudah diterapkan ke prod via MCP (007_coach_draft_funnel_view).
-- File ini arsip repo agar riwayat migrasi sinkron. Idempoten.
-- Catatan privasi: view dibuat dengan security_invoker=true (migrasi 008)
-- agar RLS tabel dasar tetap berlaku: user hanya melihat barisnya sendiri.
-- ============================================================================

create or replace view public.coach_draft_funnel as
select
  user_id,
  count(*) filter (where event_type = 'draft_shown') as drafts_shown,
  count(*) filter (where event_type = 'saved_now') as saved_from_chat,
  count(*) filter (where event_type = 'form_opened') as edited_in_form,
  count(distinct draft_key) filter (where event_type = 'draft_shown') as unique_drafts,
  count(distinct draft_key) filter (where event_type in ('saved_now', 'form_opened')) as unique_converted,
  max(created_at) as last_event_at
from public.coach_draft_events
group by user_id;

grant select on public.coach_draft_funnel to authenticated;
