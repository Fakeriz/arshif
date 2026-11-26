-- Automated daily cleanup for operational tables (idempotency keys, webhook logs, rate limit counters, sync logs).

select cron.schedule('idempotency-cleanup', '10 3 * * *',
  $$delete from public.idempotency_keys where updated_at < now() - interval '24 hours'$$);

select cron.schedule('webhook-events-cleanup', '15 3 * * *',
  $$delete from public.webhook_events
    where (processed_at is not null and processed_at < now() - interval '90 days')
       or (processed_at is null and received_at < now() - interval '30 days')$$);

select cron.schedule('edge-rate-limits-cleanup', '25 3 * * *',
  $$delete from public.edge_rate_limits where updated_at < now() - interval '7 days'$$);

select cron.schedule('sync-runs-cleanup', '35 3 * * *',
  $$delete from public.fx_sync_runs where ran_at < now() - interval '180 days';
    delete from public.asset_price_runs where ran_at < now() - interval '180 days'$$);
