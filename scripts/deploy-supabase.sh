#!/usr/bin/env bash
# Deploy backend Arshif ke proyek Supabase. Idempoten: aman dijalankan ulang.
# Butuh: SUPABASE_ACCESS_TOKEN (supabase.com/dashboard/account/tokens).
# GEMINI_API_KEY TIDAK dibaca skrip ini; set sendiri: npx supabase secrets set GEMINI_API_KEY=...
set -euo pipefail

REF="${SUPABASE_PROJECT_REF:-gyxtdpmruuhhkprlhlrk}"
API="https://api.supabase.com/v1/projects/$REF"
: "${SUPABASE_ACCESS_TOKEN:?Set SUPABASE_ACCESS_TOKEN dulu}"
cd "$(dirname "$0")/.."

TMP_AUTH_JSON=""
cleanup() {
  rm -f "${TMP_AUTH_JSON:-}"
}
trap cleanup EXIT

auth=(-H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json")
CURL_OPTS=(--connect-timeout 10 --max-time 60)

sql() { # jalankan SQL lewat Management API (tanpa password database)
  curl -fsS "${CURL_OPTS[@]}" "${auth[@]}" -X POST "$API/database/query" --data "$(node -e 'process.stdout.write(JSON.stringify({query: process.argv[1]}))' "$1")"
}

echo "1/7 link proyek"
npx supabase link --project-ref "$REF" --yes >/dev/null

echo "2/7 migrasi (lewat Management API, tanpa password database; dicatat di riwayat migrasi Supabase)"
sql "create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);" >/dev/null
applied="$(sql "select coalesce(json_agg(version), '[]') as v from supabase_migrations.schema_migrations;")"
for f in supabase/migrations/*.sql; do
  base="$(basename "$f" .sql)"; version="${base%%_*}"; name="${base#*_}"
  if echo "$applied" | grep -q "\"$version\""; then echo "   lewati $base (sudah)"; continue; fi
  first_line="$(head -n 1 "$f" || true)"
  if echo "$first_line" | grep -qiE '^--\s*no-transaction'; then
    echo "   terapkan $base (no-transaction)"
    sql "$(cat "$f")" >/dev/null
    sql "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name') on conflict (version) do nothing;" >/dev/null
  else
    echo "   terapkan $base"
    sql "begin; $(cat "$f")
; insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name'); commit;" >/dev/null
  fi
done

echo "3/7 secret cron (dibuat sekali, disimpan di Edge secrets + Vault)"
if ! npx supabase secrets list | grep -q CRON_SECRET; then
  CRON_SECRET="$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')"
  npx supabase secrets set --yes CRON_SECRET="$CRON_SECRET" >/dev/null
  sql "select vault.create_secret('$CRON_SECRET', 'cron_secret') where not exists (select 1 from vault.secrets where name = 'cron_secret');" >/dev/null
  unset CRON_SECRET
fi
sql "select vault.create_secret('https://$REF.supabase.co', 'project_url') where not exists (select 1 from vault.secrets where name = 'project_url');" >/dev/null

echo "4/7 Edge Functions"
npx supabase functions deploy --use-api --yes

echo "5/7 Auth: email OTP 6 digit (templat memuat {{ .Token }})"
TMP_AUTH_JSON="$(mktemp)"
node - <<'NODE' > "$TMP_AUTH_JSON"
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
curl -fsS "${CURL_OPTS[@]}" "${auth[@]}" -X PATCH "$API/config/auth" --data "@$TMP_AUTH_JSON" >/dev/null
rm -f "$TMP_AUTH_JSON"
TMP_AUTH_JSON=""

echo "6/7 sync kurs pertama (lewat pg_net, sama dengan jadwal cron)"
sql "select public.call_edge('fx-sync');" >/dev/null

echo "7/7 cek kesiapan endpoint health"
health_json="$(curl -fsS --connect-timeout 10 --max-time 15 --retry 3 --retry-delay 2 --retry-all-errors "https://$REF.supabase.co/functions/v1/health?check=ready")"
echo "$health_json" | grep -q '"ok":true' || { echo "Endpoint health belum siap: $health_json" >&2; exit 1; }
echo "Selesai. Cek kurs beberapa detik lagi: select count(*), max(rate_date) from fx_rates;"
