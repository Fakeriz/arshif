-- Jadwal monetisasi (pg_cron). Memakai public.call_edge dari 20261105000004_cron.sql.

-- Pesanan web yang tidak dibayar sampai batas checkout = expired (halaman status ikut berubah lewat Realtime).
select cron.schedule('orders-expire', '*/10 * * * *',
  $$update public.orders set status = 'expired', updated_at = now() where status = 'pending' and expires_at < now()$$);

-- Cocokkan ulang entitlement dengan RevenueCat: Premium yang sudah lewat masa aktif, dan grant yang gagal.
select cron.schedule('entitlement-sync', '20 * * * *', $$select public.call_edge('entitlement-sync')$$);
