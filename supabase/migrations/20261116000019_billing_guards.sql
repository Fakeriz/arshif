-- Audit Ponytail 6, 10, 11: batas AI yang tidak bisa dibalap, urutan sinkron paket, klaim webhook yang bisa pulih.
-- Semua fungsi di bawah hanya untuk Edge Functions (service role), tidak bisa dipanggil klien.

-- ---------------------------------------------------------------- 6. rate limit AI + kuota narasi Coach
-- Dulu: hitung baris ai_jobs semenit terakhir, baris baru ditulis setelah AI selesai. 50 panggilan serentak
-- melihat hitungan 0 dan lolos semua. Sekarang hitung dan catat ('started') dalam satu transaksi, berurutan
-- per pengguna; runAiJob memperbarui baris yang sama saat selesai (ok/failed/limited).
alter table public.ai_jobs drop constraint ai_jobs_status_check;
alter table public.ai_jobs add constraint ai_jobs_status_check check (status in ('started', 'ok', 'failed', 'limited'));

-- null = batas per menit tercapai (dicatat sebagai 'limited'); selain itu id baris 'started'.
create function public.ai_job_start(p_user uuid, p_kind text, p_limit integer default 10) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('ai_rate:' || p_user::text));
  if (select count(*) from public.ai_jobs where user_id = p_user and created_at >= now() - interval '1 minute') >= p_limit then
    insert into public.ai_jobs (user_id, kind, status, latency_ms, error) values (p_user, p_kind, 'limited', 0, 'rate_limited');
    return null;
  end if;
  insert into public.ai_jobs (user_id, kind, status) values (p_user, p_kind, 'started') returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.ai_job_start(uuid, text, integer) from public, anon, authenticated;

-- Narasi Coach dulu tanpa kuota (cache bisa dilewati dengan skor berbeda). Harian, seperti Tanya Coach.
-- Narasi dibuat ulang saat skor berubah, jadi batasnya longgar untuk pemakaian wajar.
insert into public.plan_limits (plan, key, monthly_limit, "window") values
  ('free', 'coachNarration', 10, 'day'), ('premium', 'coachNarration', 30, 'day');

-- ---------------------------------------------------------------- 10. urutan sinkron paket (RevenueCat)
-- syncPlan membaca status dari RevenueCat lalu menulis profil. Dua webhook bersamaan (expiry + renewal) bisa
-- menulis terbalik: yang membaca lebih dulu menulis terakhir. Kunci tidak bisa menahan panggilan HTTP, jadi
-- tiap sinkron mengambil tiket berurutan SEBELUM membaca, dan tulisan dengan tiket lebih lama diabaikan.
create sequence public.plan_sync_seq;
alter table public.profiles add column plan_sync_seq bigint not null default 0;

create function public.plan_sync_ticket() returns bigint
language sql security definer set search_path = '' as $$
  select nextval('public.plan_sync_seq')
$$;

-- Mengembalikan paket yang tersimpan setelahnya: hasil tulisan ini, atau tulisan sinkron yang lebih baru.
create function public.plan_sync_apply(p_user uuid, p_ticket bigint, p_plan text, p_until timestamptz, p_source text)
returns table (o_plan text, o_premium_until timestamptz, o_applied boolean)
language plpgsql security definer set search_path = '' as $$
declare
  v_applied boolean;
begin
  update public.profiles
     set plan = p_plan, premium_until = p_until, premium_source = p_source, plan_sync_seq = p_ticket
   where id = p_user and plan_sync_seq < p_ticket;
  v_applied := found;
  return query select p.plan, p.premium_until, v_applied from public.profiles p where p.id = p_user;
end $$;
revoke execute on function public.plan_sync_ticket() from public, anon, authenticated;
revoke execute on function public.plan_sync_apply(uuid, bigint, text, timestamptz, text) from public, anon, authenticated;

-- ---------------------------------------------------------------- 11. klaim webhook yang bisa pulih
-- Dulu event ditandai sebelum diproses dan tanda hanya dilepas di catch. Fungsi yang mati di tengah (batas
-- waktu, deploy) meninggalkan tanda: kiriman ulang penyedia dianggap duplikat, pesanan lunas tidak pernah
-- diproses. Sekarang: duplikat hanya bila sudah selesai (processed_at) atau klaimnya masih di bawah 5 menit.
alter table public.webhook_events add column claimed_at timestamptz not null default now();
alter table public.webhook_events add column processed_at timestamptz;
-- Event lama sudah selesai diproses oleh kode sebelumnya.
update public.webhook_events set claimed_at = received_at, processed_at = received_at;

-- true = klaim ini boleh memproses (baru, atau klaim lama yang macet > 5 menit dan belum selesai).
create function public.webhook_claim(p_provider text, p_event text) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.webhook_events (provider, event_id, claimed_at) values (p_provider, p_event, now())
  on conflict (provider, event_id) do update set claimed_at = now()
    where public.webhook_events.processed_at is null and public.webhook_events.claimed_at < now() - interval '5 minutes';
  return found;
end $$;

create function public.webhook_done(p_provider text, p_event text) returns void
language sql security definer set search_path = '' as $$
  update public.webhook_events set processed_at = now() where provider = p_provider and event_id = p_event
$$;
revoke execute on function public.webhook_claim(text, text) from public, anon, authenticated;
revoke execute on function public.webhook_done(text, text) from public, anon, authenticated;
