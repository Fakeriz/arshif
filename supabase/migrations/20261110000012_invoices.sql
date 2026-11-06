-- Fase 6: Invoice & Quotation (FR-INV-1, FR-INV-2) dan gerbang Money & Tax Tools (FR-TAX-3).
-- Nominal = bigint unit terkecil. Pajak dalam basis poin (1100 = 11%). Jumlah baris (subtotal, pajak, total)
-- dihitung ulang server dari item, jadi klien tidak bisa menyimpan total yang tidak cocok dengan isinya.
-- Batas Free/Premium memakai sistem migrasi 5 (enforce_counter_quota, plan_allows), tidak dibangun ulang.

-- ---------------------------------------------------------------- invoice dan penawaran
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('invoice', 'quote')),
  -- Diisi trigger: INV-2026-0001 / QUO-2026-0001, berurutan per pengguna, per tahun terbit, per jenis.
  number text not null default '',
  year smallint not null default 0,
  seq integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'sent', 'paid', 'accepted')),
  client_name text not null check (char_length(client_name) between 1 and 80),
  client_contact text check (char_length(client_contact) <= 120),
  issue_date date not null,
  -- Invoice: jatuh tempo. Penawaran: berlaku sampai.
  due_date date,
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  -- [{id, name, qty, unitPrice}] qty boleh pecahan 2 desimal (mis. 1.5 jam), unitPrice unit terkecil.
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50),
  discount bigint not null default 0 check (discount >= 0),
  tax_bp integer not null default 0 check (tax_bp between 0 and 10000),
  subtotal bigint not null default 0,
  tax bigint not null default 0,
  total bigint not null default 0,
  notes text check (char_length(notes) <= 500),
  -- Diisi invoice_mark_paid. Transaksi pemasukan tertaut (satu saja, unik).
  account_id uuid references public.accounts (id) on delete set null,
  transaction_id uuid unique references public.transactions (id) on delete set null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invoices_status_kind check (
    (kind = 'invoice' and status in ('draft', 'sent', 'paid')) or (kind = 'quote' and status in ('draft', 'sent', 'accepted'))
  ),
  constraint invoices_due_after_issue check (due_date is null or due_date >= issue_date)
);
create index invoices_user_idx on public.invoices (user_id, issue_date desc, seq desc);
create unique index invoices_number_idx on public.invoices (user_id, kind, year, seq);

create table public.invoice_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('invoice', 'quote')),
  year smallint not null,
  last integer not null,
  primary key (user_id, kind, year)
);

-- Nomor berikutnya: upsert mengunci baris penghitung, jadi dua insert bersamaan tidak mendapat nomor sama.
-- Insert yang gagal (mis. batas paket) ikut membatalkan kenaikan penghitung: tidak ada nomor yang terlewat.
create function public.invoices_assign_number() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_year smallint := extract(year from new.issue_date)::smallint;
  v_seq integer;
begin
  insert into public.invoice_counters (user_id, kind, year, last) values (new.user_id, new.kind, v_year, 1)
  on conflict (user_id, kind, year) do update set last = public.invoice_counters.last + 1
  returning last into v_seq;
  new.year := v_year;
  new.seq := v_seq;
  new.number := case new.kind when 'invoice' then 'INV' else 'QUO' end || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');
  return new;
end $$;

-- Hitung ulang jumlah dari item. Baris = qty × harga satuan, dibulatkan setengah ke atas per baris.
-- Pajak = (subtotal − diskon) × tarif, dibulatkan setengah ke atas. Sama persis dengan src/lib/invoice.ts.
create function public.invoices_compute() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_item jsonb;
  v_qty numeric;
  v_price numeric;
  v_sub numeric := 0;
begin
  for v_item in select * from jsonb_array_elements(new.items) loop
    if jsonb_typeof(v_item) <> 'object' or jsonb_typeof(v_item -> 'name') <> 'string'
       or jsonb_typeof(v_item -> 'qty') <> 'number' or jsonb_typeof(v_item -> 'unitPrice') <> 'number' then
      raise exception 'invoice_item_invalid' using errcode = '22023';
    end if;
    v_qty := (v_item ->> 'qty')::numeric;
    v_price := (v_item ->> 'unitPrice')::numeric;
    if char_length(v_item ->> 'name') not between 1 and 120 or v_qty <= 0 or v_qty > 100000 or v_qty <> round(v_qty, 2)
       or v_price < 0 or v_price <> trunc(v_price) then
      raise exception 'invoice_item_invalid' using errcode = '22023';
    end if;
    v_sub := v_sub + round(v_qty * v_price);
  end loop;
  if new.discount > v_sub then
    raise exception 'invoice_discount_exceeds' using errcode = '22023';
  end if;
  new.subtotal := v_sub;
  new.tax := round((v_sub - new.discount) * new.tax_bp / 10000.0);
  new.total := v_sub - new.discount + new.tax;
  if new.total <= 0 then
    raise exception 'invoice_total_zero' using errcode = '22023';
  end if;
  return new;
end $$;

-- Invoice yang sudah dibayar terkunci: isinya tidak bisa diubah lagi (transaksinya sudah tercatat).
-- Status tidak bisa dimundurkan dari Dibayar, dan Dibayar hanya lewat invoice_mark_paid.
create function public.invoices_guard_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'paid' then
    raise exception 'invoice_locked' using errcode = 'P0001';
  end if;
  if new.status = 'paid' and current_setting('arshif.invoice_paying', true) is distinct from 'on' then
    raise exception 'invoice_paid_via_rpc' using errcode = 'P0001';
  end if;
  -- Nomor tetap milik dokumen: tanggal terbit yang pindah tahun tidak mengubah nomornya.
  new.number := old.number;
  new.year := old.year;
  new.seq := old.seq;
  return new;
end $$;

create trigger invoices_a_quota before insert on public.invoices
  for each row execute function public.enforce_counter_quota('invoice');
create trigger invoices_b_number before insert on public.invoices
  for each row execute function public.invoices_assign_number();
create trigger invoices_c_guard before update on public.invoices
  for each row execute function public.invoices_guard_update();
create trigger invoices_d_compute before insert or update of items, discount, tax_bp on public.invoices
  for each row execute function public.invoices_compute();
create trigger invoices_refs before insert or update on public.invoices
  for each row execute function public.planning_check_refs();

-- Insert baru selalu Draf, walau klien mengirim status lain.
create function public.invoices_init() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.status := 'draft';
  new.paid_at := null;
  new.transaction_id := null;
  new.account_id := null;
  return new;
end $$;
create trigger invoices_0_init before insert on public.invoices
  for each row execute function public.invoices_init();

-- ---------------------------------------------------------------- tandai Dibayar (atomik, idempoten)
-- Dipanggil setelah transaksi pemasukan tersimpan dengan id = id invoice: primary key menolak transaksi kedua.
create function public.invoice_mark_paid(p_invoice uuid, p_transaction uuid) returns table (status text, paid_at timestamptz, transaction_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  i public.invoices;
  t public.transactions;
begin
  select * into i from public.invoices where id = p_invoice and user_id = auth.uid() for update;
  if not found then
    raise exception 'invoice_not_found' using errcode = 'P0002';
  end if;
  if i.kind <> 'invoice' then
    raise exception 'quote_cannot_be_paid' using errcode = 'P0001';
  end if;
  if i.status = 'paid' then
    if i.transaction_id is distinct from p_transaction and i.transaction_id is not null then
      raise exception 'invoice_already_paid' using errcode = 'P0001';
    end if;
    return query select i.status, i.paid_at, i.transaction_id;
    return;
  end if;
  select * into t from public.transactions where id = p_transaction and user_id = auth.uid();
  if not found then
    raise exception 'transaction_not_owned' using errcode = '42501';
  end if;
  if t.type <> 'income' or t.amount <> i.total or t.currency <> i.currency then
    raise exception 'transaction_mismatch' using errcode = '22023';
  end if;
  perform set_config('arshif.invoice_paying', 'on', true);
  update public.invoices
  set status = 'paid', paid_at = now(), transaction_id = t.id, account_id = t.account_id
  where id = i.id
  returning * into i;
  perform set_config('arshif.invoice_paying', 'off', true);
  return query select i.status, i.paid_at, i.transaction_id;
end $$;

-- ---------------------------------------------------------------- gerbang fitur Premium (FR-TAX-3)
-- Estimasi pajak lengkap, laporan pajak tahunan, dan PDF Export. Aplikasi memanggil ini sebelum membuka
-- fiturnya; keputusan diambil dari paket di server (profiles.plan), bukan dari klien.
create function public.feature_gate(p_key text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_key not in ('taxFull', 'pdfExport') then
    raise exception 'unknown_feature' using errcode = '22023';
  end if;
  if not public.plan_allows(auth.uid(), p_key) then
    raise exception 'quota_%', p_key using errcode = 'P0001';
  end if;
  return true;
end $$;

-- ---------------------------------------------------------------- kategori pemasukan freelance + sumber invoice
alter table public.transactions drop constraint transactions_source_check;
alter table public.transactions add constraint transactions_source_check
  check (source in ('manual', 'scan', 'voice', 'import', 'smartlog', 'invoice'));

-- ---------------------------------------------------------------- RLS + hak akses
alter table public.invoices enable row level security;
alter table public.invoice_counters enable row level security;
revoke all on public.invoices, public.invoice_counters from anon, authenticated;

create policy invoices_own on public.invoices for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, delete on public.invoices to authenticated;
grant insert (id, kind, client_name, client_contact, issue_date, due_date, currency, items, discount, tax_bp, notes) on public.invoices to authenticated;
-- Status Terkirim/Diterima diubah klien; Dibayar hanya lewat invoice_mark_paid (dijaga trigger).
grant update (client_name, client_contact, issue_date, due_date, currency, items, discount, tax_bp, notes, status) on public.invoices to authenticated;
-- invoice_counters: tanpa akses klien.

revoke execute on function public.invoices_assign_number(), public.invoices_compute(), public.invoices_guard_update(),
  public.invoices_init() from public, anon, authenticated;
revoke execute on function public.invoice_mark_paid(uuid, uuid), public.feature_gate(text) from public, anon;
grant execute on function public.invoice_mark_paid(uuid, uuid), public.feature_gate(text) to authenticated;
