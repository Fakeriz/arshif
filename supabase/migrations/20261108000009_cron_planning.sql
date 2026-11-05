-- Pengingat tagihan (H-3, hari H) dan langganan (H-2). Tiap jam; fungsi hanya mengirim mulai jam 07.00 lokal
-- dan dedupe_key mencegah pengingat ganda.
select cron.schedule('planning-reminders', '5 * * * *', $$select public.call_edge('planning-reminders')$$);
