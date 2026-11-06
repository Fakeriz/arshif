-- Arshif Fase 8: admin web (PRD FR-ADM-1..4).
-- Semua data admin hanya lewat RPC security definer yang memanggil assert_admin(); tabel baru tanpa akses klien.

-- ---------------------------------------------------------------- aktivitas (DAU) + suspend
alter table public.profiles
  add column last_seen_at timestamptz,
  add column suspended_at timestamptz;
-- Kolom baru tidak masuk daftar grant update kolom profil, jadi klien tidak bisa menulisnya.

-- Satu baris per pengguna per hari aktif (zona Asia/Jakarta). Ringan: paling banyak satu insert per hari.
create table public.user_activity_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
create index user_activity_days_day_idx on public.user_activity_days (day);
alter table public.user_activity_days enable row level security;
revoke all on public.user_activity_days from anon, authenticated;

-- Dipanggil aplikasi saat dibuka / kembali aktif. Ditulis paling sering 1x per 10 menit.
create function public.touch_last_seen() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then return; end if;
  update public.profiles set last_seen_at = now()
  where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '10 minutes');
  insert into public.user_activity_days (user_id, day)
  values (auth.uid(), (now() at time zone 'Asia/Jakarta')::date)
  on conflict do nothing;
end $$;

-- ---------------------------------------------------------------- log sinkronisasi kurs
create table public.fx_sync_runs (
  id bigint generated always as identity primary key,
  ran_at timestamptz not null default now(),
  trigger text not null check (trigger in ('cron', 'admin')),
  ok boolean not null,
  rate_date date,
  codes integer,
  error text check (char_length(error) <= 200)
);
create index fx_sync_runs_time_idx on public.fx_sync_runs (ran_at desc);
alter table public.fx_sync_runs enable row level security;
revoke all on public.fx_sync_runs from anon, authenticated;

-- ---------------------------------------------------------------- dasbor (FR-ADM-1)
create function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
  v_day_start timestamptz := (v_today::timestamp at time zone 'Asia/Jakarta');
  v_month_start timestamptz := (date_trunc('month', v_today)::timestamp at time zone 'Asia/Jakarta');
begin
  perform public.assert_admin();
  return jsonb_build_object(
    'today', v_today,
    'total_users', (select count(*) from auth.users),
    'new_today', (select count(*) from auth.users where created_at >= v_day_start),
    'dau', (select count(*) from public.user_activity_days where day = v_today),
    'dau_7', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date, 'users', (select count(*) from public.user_activity_days a where a.day = d::date)) order by d), '[]')
      from generate_series(v_today - 6, v_today, interval '1 day') d
    ),
    'premium_users', (select count(*) from public.profiles where plan = 'premium'),
    'premium_by_source', (
      select coalesce(jsonb_object_agg(coalesce(premium_source, 'unknown'), n), '{}')
      from (select premium_source, count(*) n from public.profiles where plan = 'premium' group by 1) s
    ),
    'suspended_users', (select count(*) from public.profiles where suspended_at is not null),
    'ai_today', (
      select coalesce(jsonb_object_agg(kind, jsonb_build_object('total', total, 'failed', failed)), '{}')
      from (
        select kind, count(*) filter (where status <> 'limited') total, count(*) filter (where status = 'failed') failed
        from public.ai_jobs where created_at >= v_day_start group by kind
      ) j
    ),
    -- Pendapatan web bulan berjalan per mata uang (unit terkecil). Grant manual tidak dihitung.
    'revenue_month', (
      select coalesce(jsonb_object_agg(currency, amount), '{}')
      from (
        select currency, sum(amount) amount from public.orders
        where provider in ('xendit', 'paddle') and status = 'paid' and paid_at >= v_month_start group by currency
      ) r
    ),
    'paid_orders_month', (select count(*) from public.orders where provider in ('xendit', 'paddle') and status = 'paid' and paid_at >= v_month_start)
  );
end $$;

-- ---------------------------------------------------------------- pengguna (FR-ADM-2)
create function public.admin_search_users(p_query text default '', p_limit integer default 50)
returns table (id uuid, email text, display_name text, plan text, premium_until timestamptz, premium_source text,
               suspended_at timestamptz, last_seen_at timestamptz, created_at timestamptz, is_admin boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  q text := lower(trim(coalesce(p_query, '')));
begin
  perform public.assert_admin();
  return query
    select u.id, u.email::text, p.display_name, p.plan, p.premium_until, p.premium_source, p.suspended_at, p.last_seen_at,
           u.created_at, exists (select 1 from public.admin_users a where a.user_id = u.id)
    from auth.users u join public.profiles p on p.id = u.id
    where q = '' or lower(u.email) like '%' || replace(replace(q, '%', '\%'), '_', '\_') || '%'
       or lower(coalesce(p.display_name, '')) like '%' || replace(replace(q, '%', '\%'), '_', '\_') || '%'
       or u.id::text = q
    order by coalesce(p.last_seen_at, u.created_at) desc
    limit least(greatest(p_limit, 1), 200);
end $$;

-- Detail satu pengguna: profil + kuota periode berjalan (sama dengan my_usage) + pesanan terakhir.
create function public.admin_user_detail(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return (
    select jsonb_build_object(
      'id', u.id, 'email', u.email, 'display_name', p.display_name, 'plan', p.plan, 'premium_until', p.premium_until,
      'premium_source', p.premium_source, 'suspended_at', p.suspended_at, 'last_seen_at', p.last_seen_at,
      'created_at', u.created_at, 'onboarded', p.onboarded_at is not null, 'main_currency', p.main_currency, 'lang', p.lang,
      'is_admin', exists (select 1 from public.admin_users a where a.user_id = u.id),
      'usage', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'key', l.key,
          'used', case when l."window" = 'total' then public.count_owned(p.id, public.total_tables(l.key))
                       when l."window" = 'feature' then 0 else coalesce(c.used, 0) end,
          'limit', l.monthly_limit, 'window', l."window") order by l.key), '[]')
        from public.plan_limits l
        left join public.usage_counters c on c.user_id = p.id and c.key = l.key and c.period = public.period_for(l."window")
        where l.plan = p.plan
      ),
      'orders', (
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', o.id, 'provider', o.provider, 'period', o.period, 'status', o.status, 'days', o.days, 'currency', o.currency,
          'amount', o.amount, 'created_at', o.created_at, 'granted_until', o.granted_until) order by o.created_at desc), '[]')
        from (select * from public.orders where user_id = p.id order by created_at desc limit 20) o
      ),
      'ai_30d', (
        select coalesce(jsonb_object_agg(kind, n), '{}')
        from (select kind, count(*) n from public.ai_jobs where user_id = p.id and created_at >= now() - interval '30 days' group by kind) j
      )
    )
    from auth.users u join public.profiles p on p.id = u.id
    where u.id = p_user
  );
end $$;

-- ---------------------------------------------------------------- kurs (FR-ADM-3)
create function public.admin_fx_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return jsonb_build_object(
    'latest_rate_date', (select max(rate_date) from public.fx_rates),
    'latest_fetched_at', (select max(fetched_at) from public.fx_rates),
    'codes', (select count(*) from public.fx_rates where rate_date = (select max(rate_date) from public.fx_rates)),
    'runs', (
      select coalesce(jsonb_agg(jsonb_build_object('ran_at', r.ran_at, 'trigger', r.trigger, 'ok', r.ok, 'rate_date', r.rate_date,
        'codes', r.codes, 'error', r.error) order by r.ran_at desc), '[]')
      from (select * from public.fx_sync_runs order by ran_at desc limit 10) r
    )
  );
end $$;

-- ---------------------------------------------------------------- broadcast in-app (FR-ADM-3)
-- Judul + isi bebas dikirim lewat vars ke kunci i18n yang hanya menampilkan {title} / {message}.
create function public.admin_broadcast(p_segment text, p_title text, p_message text, p_email text default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
  v_title text := trim(coalesce(p_title, ''));
  v_message text := trim(coalesce(p_message, ''));
begin
  perform public.assert_admin();
  if char_length(v_title) not between 1 and 80 or char_length(v_message) not between 1 and 300 then
    raise exception 'invalid_broadcast' using errcode = '22023';
  end if;
  if p_segment not in ('all', 'free', 'premium', 'email') then
    raise exception 'invalid_segment' using errcode = '22023';
  end if;
  insert into public.notifications (user_id, type, title_key, message_key, vars)
  select p.id, 'system', 'domain.notif.broadcastTitle', 'domain.notif.broadcastMessage',
         jsonb_build_object('title', v_title, 'message', v_message)
  from public.profiles p join auth.users u on u.id = p.id
  where p.suspended_at is null
    and case p_segment
      when 'all' then true
      when 'free' then p.plan = 'free'
      when 'premium' then p.plan = 'premium'
      else lower(u.email) = lower(trim(coalesce(p_email, '')))
    end;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Jumlah penerima sebelum mengirim (pratinjau di form).
create function public.admin_broadcast_count(p_segment text, p_email text default null) returns integer
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return (
    select count(*) from public.profiles p join auth.users u on u.id = p.id
    where p.suspended_at is null
      and case p_segment
        when 'all' then true
        when 'free' then p.plan = 'free'
        when 'premium' then p.plan = 'premium'
        when 'email' then lower(u.email) = lower(trim(coalesce(p_email, '')))
        else false
      end
  );
end $$;

-- ---------------------------------------------------------------- hak akses
revoke execute on function public.touch_last_seen(), public.admin_dashboard(), public.admin_search_users(text, integer),
  public.admin_user_detail(uuid), public.admin_fx_status(), public.admin_broadcast(text, text, text, text),
  public.admin_broadcast_count(text, text)
  from public, anon;
grant execute on function public.touch_last_seen(), public.admin_dashboard(), public.admin_search_users(text, integer),
  public.admin_user_detail(uuid), public.admin_fx_status(), public.admin_broadcast(text, text, text, text),
  public.admin_broadcast_count(text, text)
  to authenticated;
