-- Live Market v2 Fase 1: asset-prices-sync mencatat satu baris per penyedia (coingecko, yahoo-us, yahoo-idx, gold-api,
-- tradingview cadangan). Durasi per penyedia dicatat supaya sumber yang lambat/macet terlihat saat diagnosis.
alter table public.asset_price_runs add column duration_ms integer check (duration_ms >= 0);
