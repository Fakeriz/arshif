-- Sync harga aset live tiap jam (menit 10). Tanpa penyedia harga, run dicatat `no_provider` dan tidak menulis apa pun.
select cron.schedule('asset-prices-sync', '10 * * * *', $$select public.call_edge('asset-prices-sync')$$);
