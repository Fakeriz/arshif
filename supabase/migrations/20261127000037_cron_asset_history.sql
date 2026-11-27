-- Daily retention cleanup for asset_price_history (> 90 days).
select cron.schedule('asset-price-history-cleanup', '40 3 * * *',
  $$delete from public.asset_price_history where day < current_date - 90$$);
