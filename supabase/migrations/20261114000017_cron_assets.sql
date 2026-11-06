-- Sync harga aset live tiap jam (menit 10) lewat Edge Function asset-prices-sync (penyedia: TradingView).
select cron.schedule('asset-prices-sync', '10 * * * *', $$select public.call_edge('asset-prices-sync')$$);
