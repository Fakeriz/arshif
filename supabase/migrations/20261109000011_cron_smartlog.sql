-- Riwayat Smart Log yang sudah selesai (tercatat, dikonfirmasi, diabaikan, dibatalkan) dibersihkan setelah 60 hari.
select cron.schedule('smartlog-cleanup', '20 3 * * *',
  $$delete from public.smartlog_items where status <> 'review' and created_at < now() - interval '60 days'$$);
