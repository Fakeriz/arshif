-- Fase 4: Planning hub. Goals (FR-GOAL), Tagihan (FR-BILL), Utang/Piutang (FR-DEBT), Langganan (FR-SUB),
-- Split Bill (FR-SPLIT). Nominal = bigint unit terkecil; bunga utang dalam basis poin (2450 = 24,50%/tahun).
-- Batas Free/Premium memakai sistem dari migrasi 5 (enforce_total_limit + plan_limits), tidak dibangun ulang.

-- ---------------------------------------------------------------- batas: hanya baris yang masih aktif dihitung
-- Goal tercapai, utang lunas, dan langganan yang dihentikan tidak memakan jatah Free.
create or replace function public.count_owned(p_user uuid, p_tables text[]) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  v_total integer := 0;
  v_n integer;
  t text;
  v_active text;
begin
  foreach t in array p_tables loop
    if to_regclass('public.' || t) is not null then
      v_active := case when exists (
        select 1 from information_schema.columns where table_schema = 'public' and table_name = t and column_name = 'status'
      ) then ' and status = ''active''' else '' end;
      execute format('select count(*) from public.%I where user_id = $1', t) || v_active into v_n using p_user;
      v_total := v_total + v_n;
    end if;
  end loop;
  return v_total;
end $$;

-- ---------------------------------------------------------------- tanggal jatuh tempo berikutnya
-- Bulanan/kuartalan/tahunan memakai hari jangkar (31 -> 28/29/30 di bulan pendek, lalu kembali ke 31).
create function public.next_due(p_date date, p_freq text, p_anchor integer) returns date
language plpgsql immutable set search_path = '' as $$
declare
  v_months integer;
  v_first date;
  v_last integer;
begin
  if p_freq = 'weekly' then
    return p_date + 7;
  end if;
  v_months := case p_freq when 'monthly' then 1 when 'quarterly' then 3 when 'yearly' then 12 end;
  if v_months is null then
    raise exception 'bad_frequency %', p_freq;
  end if;
  v_first := (date_trunc('month', p_date) + make_interval(months => v_months))::date;
  v_last := extract(day from (v_first + interval '1 month' - interval '1 day'))::integer;
  return v_first + (least(p_anchor, v_last) - 1);
end $$;

-- ---------------------------------------------------------------- zona waktu pengguna (pengingat jam 07.00 lokal)
alter table public.profiles add column timezone text not null default 'Asia/Jakarta' check (char_length(timezone) <= 64);
grant update (timezone) on public.profiles to authenticated;

create function public.profiles_check_timezone() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Zona waktu tak dikenal akan menggagalkan cron pengingat untuk semua orang: ganti dengan bawaan.
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    new.timezone := 'Asia/Jakarta';
  end if;
  return new;
end $$;
create trigger profiles_timezone before insert or update of timezone on public.profiles
  for each row execute function public.profiles_check_timezone();

-- ---------------------------------------------------------------- goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  target bigint not null check (target > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  deadline date,
  account_id uuid references public.accounts (id) on delete set null,
  -- Dikelola trigger setoran, tidak bisa ditulis klien.
  collected bigint not null default 0 check (collected >= 0),
  status text not null default 'active' check (status in ('active', 'completed')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index goals_user_idx on public.goals (user_id, created_at);

create table public.goal_deposits (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount bigint not null check (amount > 0),
  date date not null,
  account_id uuid references public.accounts (id) on delete set null,
  transaction_id uuid unique references public.transactions (id) on delete set null,
  created_at timestamptz not null default now()
);
create index goal_deposits_goal_idx on public.goal_deposits (goal_id, date desc);

-- ---------------------------------------------------------------- bills (tagihan berulang)
create table public.bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  amount bigint not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  frequency text not null check (frequency in ('weekly', 'monthly', 'quarterly', 'yearly')),
  -- Jatuh tempo periode yang belum dibayar. Maju satu periode tiap kali ditandai lunas.
  due_date date not null,
  anchor_day smallint not null check (anchor_day between 1 and 31),
  account_id uuid references public.accounts (id) on delete set null,
  category_key text not null default 'bills' check (category_key ~ '^[a-z_]{1,32}$'),
  -- Tanggal jatuh tempo tiap periode yang sudah lunas (bukan boolean). Hanya diubah bill_mark_paid.
  paid_periods date[] not null default '{}',
  last_paid_tx uuid,
  created_at timestamptz not null default now()
);
create index bills_user_due_idx on public.bills (user_id, due_date);

-- ---------------------------------------------------------------- debts (utang dan piutang)
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('debt', 'receivable')),
  counterparty text not null check (char_length(counterparty) between 1 and 80),
  contact text check (char_length(contact) <= 80),
  principal bigint not null check (principal > 0),
  -- Sisa saldo. Diisi = principal saat dibuat, lalu hanya dikurangi trigger pembayaran.
  balance bigint not null check (balance >= 0),
  apr_bp integer not null default 0 check (apr_bp between 0 and 100000),
  min_payment bigint not null default 0 check (min_payment >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  due_date date,
  note text check (char_length(note) <= 200),
  split_bill_id uuid,
  status text not null default 'active' check (status in ('active', 'paid')),
  created_at timestamptz not null default now()
);
create index debts_user_idx on public.debts (user_id, created_at);

create table public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  debt_id uuid not null references public.debts (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  amount bigint not null check (amount > 0),
  date date not null,
  transaction_id uuid unique references public.transactions (id) on delete set null,
  created_at timestamptz not null default now()
);
create index debt_payments_debt_idx on public.debt_payments (debt_id, date desc);

-- ---------------------------------------------------------------- subscriptions (langganan)
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  preset text check (preset ~ '^[a-z0-9_]{1,32}$'),
  amount bigint not null check (amount > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  cycle text not null check (cycle in ('weekly', 'monthly', 'yearly')),
  next_renewal date not null,
  anchor_day smallint not null check (anchor_day between 1 and 31),
  account_id uuid references public.accounts (id) on delete set null,
  category_key text not null default 'entertainment' check (category_key ~ '^[a-z_]{1,32}$'),
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now()
);
create index subscriptions_user_idx on public.subscriptions (user_id, next_renewal);

-- ---------------------------------------------------------------- split bills
create table public.split_bills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  total bigint not null check (total > 0),
  tax bigint not null default 0 check (tax >= 0),
  service bigint not null default 0 check (service >= 0),
  mode text not null check (mode in ('equal', 'items')),
  date date not null,
  transaction_id uuid references public.transactions (id) on delete set null,
  -- [{id, name, amount, assigned: [participantId]}]
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) <= 80),
  -- [{id, name, contact, owner, share, paidAt, debtId}] share = bagian akhir (unit terkecil).
  participants jsonb not null check (jsonb_typeof(participants) = 'array' and jsonb_array_length(participants) between 1 and 30),
  created_at timestamptz not null default now()
);
create index split_bills_user_idx on public.split_bills (user_id, date desc);
alter table public.debts add constraint debts_split_fk foreign key (split_bill_id) references public.split_bills (id) on delete set null;

-- ---------------------------------------------------------------- referensi harus milik pengguna yang sama
-- RLS tidak memeriksa FK: tanpa ini goal/tagihan bisa menunjuk akun atau transaksi orang lain.
create function public.planning_check_refs() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := to_jsonb(new);
  v_ref record;
  v_ok integer;
begin
  for v_ref in
    select * from (values ('account_id', 'accounts'), ('transaction_id', 'transactions'), ('goal_id', 'goals'),
                          ('debt_id', 'debts'), ('split_bill_id', 'split_bills')) as m(col, tbl)
  loop
    if r ? v_ref.col and r ->> v_ref.col is not null then
      v_ok := null;
      execute format('select 1 from public.%I where id = $1 and user_id = $2', v_ref.tbl)
        into v_ok using (r ->> v_ref.col)::uuid, new.user_id;
      if v_ok is null then
        raise exception '%_not_owned', replace(v_ref.col, '_id', '') using errcode = '42501';
      end if;
    end if;
  end loop;
  return new;
end $$;

create trigger goals_refs before insert or update on public.goals for each row execute function public.planning_check_refs();
create trigger goal_deposits_refs before insert or update on public.goal_deposits for each row execute function public.planning_check_refs();
create trigger bills_refs before insert or update on public.bills for each row execute function public.planning_check_refs();
create trigger debts_refs before insert or update on public.debts for each row execute function public.planning_check_refs();
create trigger debt_payments_refs before insert or update on public.debt_payments for each row execute function public.planning_check_refs();
create trigger subscriptions_refs before insert or update on public.subscriptions for each row execute function public.planning_check_refs();
create trigger split_bills_refs before insert or update on public.split_bills for each row execute function public.planning_check_refs();

-- ---------------------------------------------------------------- batas Free/Premium (trigger dari migrasi 5)
create trigger goals_limit before insert on public.goals for each row execute function public.enforce_total_limit('goals');
create trigger bills_limit before insert on public.bills for each row execute function public.enforce_total_limit('billsDebts');
create trigger debts_limit before insert on public.debts for each row execute function public.enforce_total_limit('billsDebts');
create trigger subscriptions_limit before insert on public.subscriptions for each row execute function public.enforce_total_limit('subscriptions');

-- Mengaktifkan lagi langganan yang dihentikan juga memakan jatah.
create function public.subscriptions_reactivate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer;
begin
  if old.status <> 'active' and new.status = 'active' then
    perform pg_advisory_xact_lock(hashtext(new.user_id::text || ':subscriptions'));
    select l.monthly_limit into v_limit
    from public.profiles p join public.plan_limits l on l.plan = p.plan and l.key = 'subscriptions'
    where p.id = new.user_id;
    if v_limit is not null and public.count_owned(new.user_id, public.total_tables('subscriptions')) >= v_limit then
      raise exception 'quota_subscriptions' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;
create trigger subscriptions_reactivate before update of status on public.subscriptions
  for each row execute function public.subscriptions_reactivate_limit();

-- ---------------------------------------------------------------- goals: setoran -> terkumpul, tercapai -> notifikasi
create function public.goal_deposits_apply() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  g public.goals;
begin
  if tg_op = 'INSERT' then
    update public.goals set collected = collected + new.amount where id = new.goal_id returning * into g;
    if g.status = 'active' and g.collected >= g.target then
      update public.goals set status = 'completed', completed_at = now() where id = g.id;
      insert into public.notifications (user_id, type, title_key, message_key, vars, href)
      values (g.user_id, 'goal_reached', 'domain.notif.goalTitle', 'domain.notif.goalMessage',
              jsonb_build_object('name', g.name, 'amount', g.target, 'currency', g.currency), '/rencana/goals');
    end if;
    return new;
  end if;
  -- Hapus setoran: terkumpul berkurang. Status tercapai tidak dicabut (notifikasi sudah terkirim).
  update public.goals set collected = greatest(0, collected - old.amount) where id = old.goal_id;
  return old;
end $$;
create trigger goal_deposits_apply after insert or delete on public.goal_deposits
  for each row execute function public.goal_deposits_apply();

-- ---------------------------------------------------------------- utang: pembayaran mengurangi sisa saldo
create function public.debt_payments_apply() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  d public.debts;
begin
  select * into d from public.debts where id = new.debt_id for update;
  if d.status <> 'active' then
    raise exception 'debt_closed' using errcode = 'P0001';
  end if;
  if new.amount > d.balance then
    raise exception 'payment_exceeds_balance' using errcode = 'P0001';
  end if;
  update public.debts
  set balance = d.balance - new.amount,
      status = case when d.balance - new.amount = 0 then 'paid' else 'active' end
  where id = d.id;
  return new;
end $$;
create trigger debt_payments_apply before insert on public.debt_payments
  for each row execute function public.debt_payments_apply();

-- Saldo awal = pokok (klien tidak bisa membuat utang yang "sudah sebagian lunas" tanpa riwayat pembayaran).
create function public.debts_init_balance() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.balance := new.principal;
  new.status := 'active';
  return new;
end $$;
create trigger debts_init before insert on public.debts for each row execute function public.debts_init_balance();

-- ---------------------------------------------------------------- tagihan: tandai lunas (atomik, idempoten)
-- Dipanggil SETELAH transaksi pengeluarannya tersimpan. Periode yang dibayar = due_date saat ini.
create function public.bill_mark_paid(p_bill uuid, p_transaction uuid) returns table (due_date date, paid_periods date[])
language plpgsql security definer set search_path = '' as $$
declare
  b public.bills;
  v_paid date[];
begin
  select * into b from public.bills where id = p_bill and user_id = auth.uid() for update;
  if not found then
    raise exception 'bill_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.transactions where id = p_transaction and user_id = auth.uid()) then
    raise exception 'transaction_not_owned' using errcode = '42501';
  end if;
  -- Pengiriman ulang dengan transaksi yang sama tidak memajukan periode dua kali.
  if b.last_paid_tx is distinct from p_transaction then
    v_paid := case when b.due_date = any (b.paid_periods) then b.paid_periods else b.paid_periods || b.due_date end;
    -- Simpan 60 periode terakhir (lebih dari setahun untuk tagihan mingguan).
    v_paid := v_paid[greatest(1, cardinality(v_paid) - 59):];
    update public.bills
    set paid_periods = v_paid,
        due_date = public.next_due(b.due_date, b.frequency, b.anchor_day),
        last_paid_tx = p_transaction
    where id = b.id
    returning * into b;
  end if;
  return query select b.due_date, b.paid_periods;
end $$;

-- ---------------------------------------------------------------- pengingat harian (Edge Function planning-reminders)
alter table public.notifications add column dedupe_key text check (char_length(dedupe_key) <= 120);
create unique index notifications_dedupe_idx on public.notifications (user_id, dedupe_key) where dedupe_key is not null;
alter table public.notifications drop constraint notifications_href_check;
alter table public.notifications add constraint notifications_href_check
  check (href in ('/coach', '/anggaran', '/pengaturan', '/premium', '/rencana/goals', '/rencana/tagihan', '/rencana/utang', '/rencana/langganan', '/rencana/split'));

-- Tagihan H-3 dan hari H, langganan H-2, mulai jam 07.00 waktu lokal pengguna. Dijalankan tiap jam;
-- dedupe_key membuat tiap pengingat terkirim sekali. Mengembalikan jumlah notifikasi baru.
create function public.planning_reminders(p_now timestamptz default now()) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer := 0;
  v_n integer;
begin
  -- Langganan yang tanggal perpanjangannya sudah lewat maju ke periode berikutnya.
  update public.subscriptions s
  set next_renewal = public.next_due(s.next_renewal, s.cycle, s.anchor_day)
  from public.profiles p
  where p.id = s.user_id and s.status = 'active'
    and s.next_renewal < (p_now at time zone p.timezone)::date;

  with local as (
    select p.id, p.notif_prefs, (p_now at time zone p.timezone)::date as today, extract(hour from p_now at time zone p.timezone) as hour
    from public.profiles p
  ), due as (
    select b.*, l.today, b.due_date - l.today as days
    from public.bills b join local l on l.id = b.user_id
    where l.hour >= 7
      and coalesce((l.notif_prefs ->> 'bill_due')::boolean, true)
      and not (b.due_date = any (b.paid_periods))
      and b.due_date - l.today in (0, 3)
  )
  insert into public.notifications (user_id, type, title_key, message_key, vars, href, dedupe_key)
  select user_id, 'bill_due',
         case when days = 0 then 'domain.notif.billTodayTitle' else 'domain.notif.billSoonTitle' end,
         'domain.notif.billDueMessage',
         jsonb_build_object('biller', name, 'amount', amount, 'currency', currency, 'date', due_date, 'days', days),
         '/rencana/tagihan', 'bill:' || id || ':' || due_date || ':' || days
  from due
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_n = row_count;
  v_count := v_count + v_n;

  with local as (
    select p.id, (p_now at time zone p.timezone)::date as today, extract(hour from p_now at time zone p.timezone) as hour
    from public.profiles p
  )
  insert into public.notifications (user_id, type, title_key, message_key, vars, href, dedupe_key)
  select s.user_id, 'subscription_renewal', 'domain.notif.subTitle', 'domain.notif.subMessage',
         jsonb_build_object('name', s.name, 'amount', s.amount, 'currency', s.currency, 'date', s.next_renewal),
         '/rencana/langganan', 'sub:' || s.id || ':' || s.next_renewal
  from public.subscriptions s join local l on l.id = s.user_id
  where l.hour >= 7 and s.status = 'active' and s.next_renewal - l.today = 2
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing;
  get diagnostics v_n = row_count;
  return v_count + v_n;
end $$;

-- ---------------------------------------------------------------- RLS + grant kolom
alter table public.goals enable row level security;
alter table public.goal_deposits enable row level security;
alter table public.bills enable row level security;
alter table public.debts enable row level security;
alter table public.debt_payments enable row level security;
alter table public.subscriptions enable row level security;
alter table public.split_bills enable row level security;

-- Tabel baru mewarisi default privileges Supabase (ALL untuk anon/authenticated): cabut dulu, lalu grant per kolom.
revoke all on public.goals, public.goal_deposits, public.bills, public.debts, public.debt_payments,
  public.subscriptions, public.split_bills from anon, authenticated;
grant select, delete on public.goals, public.goal_deposits, public.bills, public.debts,
  public.subscriptions, public.split_bills to authenticated;
-- Pembayaran utang tidak bisa dihapus: saldo utang sudah dikurangi trigger dan tidak dikembalikan.
grant select on public.debt_payments to authenticated;

grant insert (id, name, target, currency, deadline, account_id) on public.goals to authenticated;
grant update (name, target, deadline, account_id) on public.goals to authenticated;
grant insert (id, goal_id, amount, date, account_id, transaction_id) on public.goal_deposits to authenticated;

grant insert (id, name, amount, currency, frequency, due_date, anchor_day, account_id, category_key) on public.bills to authenticated;
grant update (name, amount, currency, frequency, due_date, anchor_day, account_id, category_key) on public.bills to authenticated;

grant insert (id, kind, counterparty, contact, principal, apr_bp, min_payment, currency, due_date, note, split_bill_id) on public.debts to authenticated;
grant update (counterparty, contact, apr_bp, min_payment, due_date, note) on public.debts to authenticated;
grant insert (id, debt_id, amount, date, transaction_id) on public.debt_payments to authenticated;

grant insert (id, name, preset, amount, currency, cycle, next_renewal, anchor_day, account_id, category_key) on public.subscriptions to authenticated;
grant update (name, amount, currency, cycle, next_renewal, anchor_day, account_id, category_key, status) on public.subscriptions to authenticated;

grant insert (id, title, currency, total, tax, service, mode, date, transaction_id, items, participants) on public.split_bills to authenticated;
grant update (title, total, tax, service, mode, items, participants) on public.split_bills to authenticated;

create policy goals_all on public.goals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy goal_deposits_all on public.goal_deposits for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy bills_all on public.bills for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy debts_all on public.debts for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy debt_payments_all on public.debt_payments for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy subscriptions_all on public.subscriptions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy split_bills_all on public.split_bills for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke execute on function public.next_due(date, text, integer), public.profiles_check_timezone(), public.planning_check_refs(),
  public.subscriptions_reactivate_limit(), public.goal_deposits_apply(),
  public.debt_payments_apply(), public.debts_init_balance(), public.planning_reminders(timestamptz), public.count_owned(uuid, text[])
  from public, anon, authenticated;
revoke execute on function public.bill_mark_paid(uuid, uuid) from public, anon;
grant execute on function public.bill_mark_paid(uuid, uuid) to authenticated;
