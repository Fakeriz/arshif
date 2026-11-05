#!/usr/bin/env bash
# Deploy backend Arshif ke proyek Supabase (Fase 2). Idempoten: aman dijalankan ulang.
# Butuh: SUPABASE_ACCESS_TOKEN (supabase.com/dashboard/account/tokens).
# GEMINI_API_KEY TIDAK dibaca skrip ini; set sendiri: npx supabase secrets set GEMINI_API_KEY=...
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-gyxtdpmruuhhkprlhlrk}"
API="https://api.supabase.com/v1/projects/$REF"
: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN dulu}"
cd "$(dirname "$0")/.."

auth=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json")

sql() { # jalankan SQL lewat Management API (tanpa password database)
  curl -fsS "${auth[@]}" -X POST "$API/database/query" --data "$(node -e 'process.stdout.write(JSON.stringify({query: process.argv[1]}))' "$1")"
}

echo "1/6 link proyek"
npx supabase link --project-ref "$REF" --yes >/dev/null

echo "2/6 migrasi (lewat Management API, tanpa password database; dicatat di riwayat migrasi Supabase)"
sql "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);" >/dev/null
applied="$(sql "select coalesce(json_agg(version), '[]') as v from supabase_migrations.schema_migrations;")"
for f in supabase/migrations/*.sql; do
  base="$(basename "$f" .sql)"; version="${base%%_*}"; name="${base#*_}"
  if echo "$applied" | grep -q "\"$version\""; then echo "   lewati $base (sudah)"; continue; fi
  echo "   terapkan $base"
  sql "begin; $(cat "$f")
; insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name'); commit;" >/dev/null
done

echo "3/6 secret cron (dibuat sekali, disimpan di Edge secrets + Vault)"
if ! npx supabase secrets list | grep -q CRON_SECRET; then
  CRON_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  npx supabase secrets set --yes CRON_SECRET="$CRON_SECRET" >/dev/null
  sql "select vault.create_secret('$CRON_SECRET', 'cron_secret') where not exists (select 1 from vault.secrets where name = 'cron_secret');" >/dev/null
  unset CRON_SECRET
fi
sql "select vault.create_secret('https://$REF.supabase.co', 'project_url') where not exists (select 1 from vault.secrets where name = 'project_url');" >/dev/null

echo "4/6 Edge Functions"
npx supabase functions deploy --use-api --yes

echo "5/6 Auth: email OTP 6 digit (templat memuat {{ .Token }})"
node - <<'NODE' > /tmp/arshif-auth-config.json
const body = (title) => `<h2>${title}</h2><p>Kode masuk Arshif kamu:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">{{ .Token }}</p><p>Kode berlaku 1 jam. Abaikan email ini kalau kamu tidak meminta kode.</p><p>Your Arshif sign-in code is above. Ignore this email if you did not request it.</p>`;
process.stdout.write(JSON.stringify({
  mailer_otp_length: 6,
  mailer_otp_exp: 3600,
  mailer_subjects_magic_link: 'Kode masuk Arshif / Arshif sign-in code',
  mailer_templates_magic_link_content: body('Kode masuk Arshif'),
  mailer_subjects_confirmation: 'Kode masuk Arshif / Arshif sign-in code',
  mailer_templates_confirmation_content: body('Selamat datang di Arshif'),
}));
NODE
curl -fsS "${auth[@]}" -X PATCH "$API/config/auth" --data @/tmp/arshif-auth-config.json >/dev/null
rm -f /tmp/arshif-auth-config.json

echo "6/6 sync kurs pertama (lewat pg_net, sama dengan jadwal cron)"
sql "select public.call_edge('fx-sync');" >/dev/null
echo "Selesai. Cek kurs beberapa detik lagi: select count(*), max(rate_date) from fx_rates;"
