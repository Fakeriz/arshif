-- Perbaikan audit 2026-11-21.

-- 1. Plan efektif: Premium yang sudah lewat premium_until dihitung Free saat itu juga,
--    tanpa menunggu entitlement-sync (jalan per jam) menurunkan profiles.plan.
create function public.effective_plan(p_plan text, p_until timestamptz) returns text
language sql stable set search_path = '' as $$
  select case when p_plan = 'premium' and p_until is not null and p_until <= now() then 'free' else p_plan end
$$;

-- Periode kuota pada waktu tertentu (period_for = periode sekarang).
create function public.period_at(p_window text, p_at timestamptz) returns text
language sql stable set search_path = '' as $$
  select case p_window
    when 'day' then to_char(p_at at time zone 'utc', 'YYYY-MM-DD')
    else to_char(p_at at time zone 'utc', 'YYYY-MM') end
$$;

create or replace function public.quota_try_consume(p_user uuid, p_key text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer;
  v_window text;
  v_period text;
  v_used integer;
begin
  select l.monthly_limit, l."window" into v_limit, v_window
  from public.profiles p join public.plan_limits l on l.plan = public.effective_plan(p.plan, p.premium_until) and l.key = p_key
  where p.id = p_user;
  if not found then raise exception 'unknown_quota'; end if;
  if v_window not in ('month', 'day') then raise exception 'not_counter_quota'; end if;
  v_period := public.period_for(v_window);

  insert into public.usage_counters (user_id, period, key, used) values (p_user, v_period, p_key, 0)
  on conflict do nothing;

  update public.usage_counters set used = used + 1
  where user_id = p_user and period = v_period and key = p_key
    and (v_limit is null or used < v_limit)
  returning used into v_used;
  return v_used is not null;
end $$;

-- 2. Pengembalian kuota ke periode saat kuota DIAMBIL (p_at), bukan saat pekerjaan selesai:
--    scan yang mulai 23.59 tanggal 31 dan gagal 00.00 tanggal 1 mengembalikan kuota Januari.
drop function public.quota_refund(uuid, text);
create function public.quota_refund(p_user uuid, p_key text, p_at timestamptz default now()) returns void
language sql security definer set search_path = '' as $$
  update public.usage_counters set used = greatest(used - 1, 0)
  where user_id = p_user and key = p_key and period = public.period_at(public.limit_window(p_key), p_at);
$$;
revoke execute on function public.quota_refund(uuid, text, timestamptz) from public, anon, authenticated;

create or replace function public.enforce_total_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_key text := tg_argv[0];
  v_limit integer;
begin
  -- Kunci per (pengguna, batas): insert paralel tidak bisa sama-sama lolos hitungan.
  perform pg_advisory_xact_lock(hashtext(new.user_id::text || ':' || v_key));
  select l.monthly_limit into v_limit
  from public.profiles p join public.plan_limits l on l.plan = public.effective_plan(p.plan, p.premium_until) and l.key = v_key
  where p.id = new.user_id;
  if v_limit is not null and public.count_owned(new.user_id, public.total_tables(v_key)) >= v_limit then
    raise exception 'quota_%', v_key using errcode = 'P0001';
  end if;
  return new;
end $$;

create or replace function public.plan_allows(p_user uuid, p_key text) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select l.monthly_limit is null or l.monthly_limit > 0
    from public.profiles p join public.plan_limits l on l.plan = public.effective_plan(p.plan, p.premium_until) and l.key = p_key
    where p.id = p_user), false)
$$;

create or replace function public.subscriptions_reactivate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_limit integer;
begin
  if old.status <> 'active' and new.status = 'active' then
    perform pg_advisory_xact_lock(hashtext(new.user_id::text || ':subscriptions'));
    select l.monthly_limit into v_limit
    from public.profiles p join public.plan_limits l on l.plan = public.effective_plan(p.plan, p.premium_until) and l.key = 'subscriptions'
    where p.id = new.user_id;
    if v_limit is not null and public.count_owned(new.user_id, public.total_tables('subscriptions')) >= v_limit then
      raise exception 'quota_subscriptions' using errcode = 'P0001';
    end if;
  end if;
  return new;
end $$;

-- 3. Refund hanya menggeser pesanan berikutnya sebesar sisa yang BELUM terpakai dari pesanan ini.
--    Sebelumnya durasi penuh: refund di tengah masa aktif memotong hari yang sudah dibayar pesanan berikutnya.
create or replace function public.refund_shift(p_order uuid) returns timestamptz
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
  v_len interval;
  v_end timestamptz;
begin
  select * into o from public.orders where id = p_order;
  if not found then raise exception 'order_not_found'; end if;
  perform pg_advisory_xact_lock(hashtext('grant:' || o.user_id::text));
  if o.granted_from is not null and o.granted_until is not null and o.grant_error is distinct from 'refund_applied' then
    v_len := greatest(o.granted_until - greatest(o.granted_from, now()), interval '0');
    update public.orders set granted_from = granted_from - v_len, granted_until = granted_until - v_len, updated_at = now()
    where user_id = o.user_id and status = 'paid' and id <> o.id and granted_from >= o.granted_until;
    update public.orders set grant_error = 'refund_applied', updated_at = now() where id = o.id;
  end if;
  select max(granted_until) into v_end from public.orders
  where user_id = o.user_id and status = 'paid' and id <> o.id and granted_until > now();
  return v_end;
end $$;

-- 4. Pesanan akun yang sudah dihapus (user_id null) tetap tampil di daftar admin.
create or replace function public.admin_orders(p_status text default null, p_limit integer default 200)
returns table (id uuid, user_id uuid, email text, provider text, period text, currency text, amount bigint, method text,
               status text, created_at timestamptz, paid_at timestamptz, granted_until timestamptz, grant_error text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return query
    select o.id, o.user_id, u.email::text, o.provider, o.period, o.currency, o.amount, o.method,
           o.status, o.created_at, o.paid_at, o.granted_until, o.grant_error
    from public.orders o left join auth.users u on u.id = o.user_id
    where p_status is null or o.status = p_status
    order by o.created_at desc
    limit least(greatest(p_limit, 1), 500);
end $$;

-- 5. Tidak dipakai lagi (Edge Function admin-grant sudah tidak ada).
drop function public.admin_find_user_internal(text);

revoke execute on function public.effective_plan(text, timestamptz), public.period_at(text, timestamptz) from public, anon, authenticated;
