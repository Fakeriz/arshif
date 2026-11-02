-- ============================================================================
-- MIGRASI 006: coach_draft_events - adopsi catat transaksi dari chat AI coach.
-- ----------------------------------------------------------------------------
-- CARA PAKAI: python3 supabase-apply.py supabase/migrations/006-coach-draft-events.sql
-- Idempoten: aman dijalankan berulang kali.
--
-- Satu baris per kejadian, ditautkan lewat draft_key (kunci pesan coach):
--   draft_shown  - server mengembalikan draft ke client
--   saved_now    - user menekan "Ya, catat" (simpan langsung)
--   form_opened  - user menekan pensil (edit di form)
-- Tidak ada isi nominal sensitif selain amount + type; tanpa note/merchant.
-- ============================================================================

create table if not exists public.coach_draft_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('draft_shown', 'saved_now', 'form_opened')),
  draft_key text not null,
  tx_type text,
  amount numeric,
  created_at timestamptz default now()
);

create index if not exists coach_draft_events_user_idx
  on public.coach_draft_events(user_id, created_at desc);

create index if not exists coach_draft_events_key_idx
  on public.coach_draft_events(user_id, draft_key);

alter table public.coach_draft_events enable row level security;

drop policy if exists "coach_draft_events own select" on public.coach_draft_events;
create policy "coach_draft_events own select" on public.coach_draft_events
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "coach_draft_events own insert" on public.coach_draft_events;
create policy "coach_draft_events own insert" on public.coach_draft_events
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

grant select, insert on public.coach_draft_events to authenticated;
