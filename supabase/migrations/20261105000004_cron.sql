-- Jadwal server (pg_cron). Pemanggilan Edge Function memakai pg_net + secret dari Vault:
--   project_url  = https://<ref>.supabase.co
--   cron_secret  = nilai yang sama dengan secret CRON_SECRET di Edge Functions
-- Keduanya dibuat saat deploy (lihat docs/fase2-deploy.md), bukan di migrasi, agar tidak masuk git.
create extension if not exists pg_cron;
create extension if not exists pg_net;

create function public.call_edge(p_name text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url');
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret');
begin
  if v_url is null or v_key is null then
    raise warning 'call_edge(%): secret project_url/cron_secret belum ada di Vault', p_name;
    return;
  end if;
  perform net.http_post(
    url := v_url || '/functions/v1/' || p_name,
    headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', v_key),
    body := '{}'::jsonb
  );
end $$;
revoke execute on function public.call_edge(text) from public, anon, authenticated;

-- Kurs: Frankfurter (ECB) terbit sekali sehari kerja ~16:00 CET. Ambil 3x sehari agar cepat terbarui.
select cron.schedule('fx-sync', '15 0,8,16 * * *', $$select public.call_edge('fx-sync')$$);

-- Notifikasi lebih dari 90 hari dihapus (FR-NOTIF-2).
select cron.schedule('notifications-cleanup', '30 3 * * *',
  $$delete from public.notifications where created_at < now() - interval '90 days'$$);

-- Log AI disimpan 180 hari.
select cron.schedule('ai-jobs-cleanup', '45 3 * * *',
  $$delete from public.ai_jobs where created_at < now() - interval '180 days'$$);
