-- Fase 5: Smart Log (FR-SLOG-1..5). Notifikasi bank Android -> transaksi, review-first.
-- Parser berjalan di perangkat (OTP/promo/gagal tidak pernah dikirim). Server memutuskan: kuota automation,
-- tautan package -> akun, duplikat, dan auto-apply HANYA untuk expense + IDR + kartu tertaut + lolos semua cek.

-- ---------------------------------------------------------------- saklar automation per pengguna
alter table public.profiles add column smartlog_enabled boolean not null default false;
grant update (smartlog_enabled) on public.profiles to authenticated;

-- ---------------------------------------------------------------- tautan package aplikasi bank -> akun
create table public.smartlog_links (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  package text not null check (package ~ '^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$' and char_length(package) <= 100),
  account_id uuid not null references public.accounts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, package)
);

create function public.smartlog_links_check_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.accounts where id = new.account_id and user_id = new.user_id) then
    raise exception 'account_not_owned' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger smartlog_links_owner before insert or update on public.smartlog_links
  for each row execute function public.smartlog_links_check_owner();

-- ---------------------------------------------------------------- notifikasi yang sudah diproses
-- Satu baris per notifikasi (capture_key unik = kirim ulang aman). Transaksi yang tercatat memakai id yang sama
-- dengan barisnya, jadi konfirmasi ganda tidak bisa membuat dua transaksi.
create table public.smartlog_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  capture_key text not null check (char_length(capture_key) between 1 and 200),
  package text not null check (char_length(package) <= 100),
  bank text not null check (bank ~ '^[a-z0-9]{1,24}$'),
  posted_at timestamptz not null,
  date date not null,
  time time not null,
  type text not null check (type in ('expense', 'income')),
  amount bigint not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  merchant text not null default '' check (char_length(merchant) <= 120),
  account_id uuid references public.accounts (id) on delete set null,
  status text not null check (status in ('review', 'applied', 'confirmed', 'dismissed', 'undone')),
  reasons text[] not null default '{}',
  -- Teks notifikasi (tanpa baris saldo) hanya disimpan selama perlu dicek, lalu dihapus.
  excerpt text check (char_length(excerpt) <= 300),
  fingerprint text not null check (char_length(fingerprint) <= 64),
  transaction_id uuid references public.transactions (id) on delete set null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (user_id, capture_key)
);
create index smartlog_items_user_idx on public.smartlog_items (user_id, status, created_at desc);
create index smartlog_items_fp_idx on public.smartlog_items (user_id, fingerprint, created_at desc);

-- ---------------------------------------------------------------- ingest
-- Dipanggil aplikasi per notifikasi yang lolos parser. Hasil:
--   disabled = automation OFF, quota = kuota automation habis (tidak diproses), lainnya = status baris.
create function public.smartlog_ingest(
  p_capture_key text, p_package text, p_bank text, p_posted_at timestamptz, p_date date, p_time time,
  p_type text, p_amount bigint, p_currency text, p_merchant text, p_excerpt text, p_fingerprint text, p_doubts text[]
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_item public.smartlog_items;
  v_account uuid;
  v_account_currency text;
  v_reasons text[];
  v_status text;
  v_id uuid := gen_random_uuid();
begin
  if v_uid is null then raise exception 'unauthorized' using errcode = '42501'; end if;
  if not coalesce((select smartlog_enabled from public.profiles where id = v_uid), false) then
    return jsonb_build_object('status', 'disabled');
  end if;

  select * into v_item from public.smartlog_items where user_id = v_uid and capture_key = p_capture_key;
  if found then
    return jsonb_build_object('status', v_item.status, 'id', v_item.id, 'reasons', to_jsonb(v_item.reasons), 'repeat', true);
  end if;

  if p_type not in ('expense', 'income') or p_amount is null or p_amount <= 0 then
    raise exception 'bad_input' using errcode = '22023';
  end if;
  -- Keraguan dari parser hanya dari daftar yang dikenal; nilai lain diabaikan.
  v_reasons := array(select distinct d from unnest(coalesce(p_doubts, '{}')) d
                     where d in ('type_unclear', 'topup', 'multiple_amounts') order by d);

  if not public.quota_try_consume(v_uid, 'automation') then
    -- Pengguna diberi tahu sekali per bulan lewat lonceng; aplikasi juga menahan notifikasinya.
    insert into public.notifications (user_id, type, title_key, message_key, href, dedupe_key)
    values (v_uid, 'quota_warning', 'domain.notif.smartlogQuotaTitle', 'domain.notif.smartlogQuotaMessage', '/premium',
            'smartlog-quota:' || public.current_period())
    on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
    return jsonb_build_object('status', 'quota');
  end if;

  select l.account_id, a.currency into v_account, v_account_currency
  from public.smartlog_links l join public.accounts a on a.id = l.account_id
  where l.user_id = v_uid and l.package = p_package;

  if p_type <> 'expense' then v_reasons := array_append(v_reasons, 'not_expense'); end if;
  if p_currency <> 'IDR' then v_reasons := array_append(v_reasons, 'not_idr'); end if;
  if v_account is null then v_reasons := array_append(v_reasons, 'no_link');
  elsif v_account_currency <> p_currency then v_reasons := array_append(v_reasons, 'account_currency');
  end if;

  -- Duplikat: notifikasi yang sama (sidik) dalam 2 hari, atau transaksi yang sudah ada dengan akun, jenis,
  -- nominal, dan tanggal sama dalam selisih 10 menit (mis. dicatat manual, atau dua aplikasi satu bank).
  if exists (select 1 from public.smartlog_items i
             where i.user_id = v_uid and i.fingerprint = p_fingerprint and i.created_at > now() - interval '2 days')
     or (v_account is not null and exists (
           select 1 from public.transactions t
           where t.user_id = v_uid and t.account_id = v_account and t.type = p_type and t.amount = p_amount
             and t.currency = p_currency and t.date = p_date
             and abs(extract(epoch from (t.time - p_time))) <= 600)) then
    v_reasons := array_append(v_reasons, 'duplicate');
  end if;

  v_status := case when cardinality(v_reasons) = 0 then 'applied' else 'review' end;

  insert into public.smartlog_items (id, user_id, capture_key, package, bank, posted_at, date, time, type, amount, currency,
                                     merchant, account_id, status, reasons, excerpt, fingerprint)
  values (v_id, v_uid, p_capture_key, p_package, p_bank, p_posted_at, p_date, p_time, p_type, p_amount, p_currency,
          left(coalesce(p_merchant, ''), 120), v_account, v_status, v_reasons,
          case when v_status = 'review' then left(p_excerpt, 300) end, p_fingerprint);

  if v_status = 'applied' then
    insert into public.transactions (id, user_id, type, merchant, category_key, account_id, date, time, amount, currency, source)
    values (v_id, v_uid, 'expense', left(coalesce(p_merchant, ''), 120), 'other', v_account, p_date, p_time, p_amount, p_currency, 'smartlog');
    update public.smartlog_items set transaction_id = v_id, resolved_at = now() where id = v_id;
  end if;

  return jsonb_build_object('status', v_status, 'id', v_id, 'reasons', to_jsonb(v_reasons));
end $$;

-- Konfirmasi dari To Review: aplikasi sudah menyimpan transaksinya (id = id baris, kurs dihitung klien).
create function public.smartlog_confirm(p_item uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.transactions where id = p_item and user_id = auth.uid()) then
    raise exception 'transaction_missing' using errcode = 'P0002';
  end if;
  update public.smartlog_items set status = 'confirmed', transaction_id = p_item, excerpt = null, resolved_at = now()
  where id = p_item and user_id = auth.uid() and status = 'review';
  if not found then raise exception 'not_in_review' using errcode = 'P0002'; end if;
end $$;

create function public.smartlog_dismiss(p_item uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.smartlog_items set status = 'dismissed', excerpt = null, resolved_at = now()
  where id = p_item and user_id = auth.uid() and status = 'review';
  if not found then raise exception 'not_in_review' using errcode = 'P0002'; end if;
end $$;

-- Undo untuk yang auto-apply: transaksinya dihapus (saldo dihitung ulang trigger).
create function public.smartlog_undo(p_item uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_tx uuid;
begin
  update public.smartlog_items set status = 'undone', resolved_at = now()
  where id = p_item and user_id = auth.uid() and status = 'applied'
  returning transaction_id into v_tx;
  if not found then raise exception 'not_applied' using errcode = 'P0002'; end if;
  if v_tx is not null then
    delete from public.transactions where id = v_tx and user_id = auth.uid();
  end if;
end $$;

-- ---------------------------------------------------------------- notifikasi: tautan ke layar Smart Log
alter table public.notifications drop constraint notifications_href_check;
alter table public.notifications add constraint notifications_href_check
  check (href in ('/coach', '/anggaran', '/pengaturan', '/premium', '/rencana/goals', '/rencana/tagihan', '/rencana/utang',
                  '/rencana/langganan', '/rencana/split', '/otomasi', '/otomasi/tinjau'));

-- ---------------------------------------------------------------- RLS + hak
alter table public.smartlog_links enable row level security;
alter table public.smartlog_items enable row level security;
revoke all on public.smartlog_links, public.smartlog_items from anon, authenticated;

grant select, delete on public.smartlog_links to authenticated;
grant insert (package, account_id) on public.smartlog_links to authenticated;
grant update (account_id) on public.smartlog_links to authenticated;
create policy smartlog_links_all on public.smartlog_links for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Baris hanya ditulis lewat RPC di atas.
grant select on public.smartlog_items to authenticated;
create policy smartlog_items_select on public.smartlog_items for select to authenticated using (user_id = (select auth.uid()));

revoke execute on function public.smartlog_links_check_owner() from public, anon, authenticated;
revoke execute on function public.smartlog_ingest(text, text, text, timestamptz, date, time, text, bigint, text, text, text, text, text[]),
  public.smartlog_confirm(uuid), public.smartlog_dismiss(uuid), public.smartlog_undo(uuid) from public, anon;
grant execute on function public.smartlog_ingest(text, text, text, timestamptz, date, time, text, bigint, text, text, text, text, text[]),
  public.smartlog_confirm(uuid), public.smartlog_dismiss(uuid), public.smartlog_undo(uuid) to authenticated;
