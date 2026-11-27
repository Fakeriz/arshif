-- Arshif Admin Console v2: ringkasan operasional terpadu (DAU 30 hari, sebaran bahasa/mata uang,
-- riwayat sinkron harga aset, webhook 7 hari, pesanan tertahan, dan riwayat broadcast terakhir).
-- Hanya bisa dipanggil akun admin lewat assert_admin().

create or replace function public.admin_ops_overview() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  perform public.assert_admin();
  return jsonb_build_object(
    'today', v_today,
    'onboarded_users', (select count(*)::int from public.profiles where onboarded_at is not null),
    'dau_30', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'day', d::date,
            'users', (select count(*)::int from public.user_activity_days a where a.day = d::date)
          )
          order by d
        ),
        '[]'::jsonb
      )
      from generate_series(v_today - 29, v_today, interval '1 day') d
    ),
    'currencies', (
      select coalesce(jsonb_object_agg(main_currency, n), '{}'::jsonb)
      from (select main_currency, count(*)::int n from public.profiles group by 1) c
    ),
    'langs', (
      select coalesce(jsonb_object_agg(lang, n), '{}'::jsonb)
      from (select lang, count(*)::int n from public.profiles group by 1) l
    ),
    'asset_runs', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'ran_at', r.ran_at,
            'trigger', r.trigger,
            'ok', r.ok,
            'source', r.source,
            'symbols', r.symbols,
            'updated', r.updated,
            'failed_count', coalesce(cardinality(r.failed), 0),
            'failed_sample', coalesce(to_jsonb(r.failed[1:5]), '[]'::jsonb),
            'error', r.error,
            'duration_ms', r.duration_ms
          )
          order by r.ran_at desc
        ),
        '[]'::jsonb
      )
      from (select * from public.asset_price_runs order by ran_at desc limit 15) r
    ),
    'webhooks_7d', (
      select coalesce(jsonb_object_agg(provider, n), '{}'::jsonb)
      from (
        select provider, count(*)::int n
        from public.webhook_events
        where received_at >= now() - interval '7 days'
        group by 1
      ) w
    ),
    'stuck_orders', (
      select count(*)::int
      from public.orders
      where status = 'paid'
        and user_id is not null
        and grant_error is not null
        and grant_error not in ('refund_applied', 'partial_refund')
    ),
    'recent_broadcasts', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'sent_at', b.sent_at,
            'title', b.title,
            'message', b.message,
            'recipients', b.recipients
          )
          order by b.sent_at desc
        ),
        '[]'::jsonb
      )
      from (
        select
          max(created_at) as sent_at,
          coalesce(vars->>'title', '') as title,
          coalesce(vars->>'message', '') as message,
          count(*)::int as recipients
        from public.notifications
        where type = 'system'
          and title_key = 'domain.notif.broadcastTitle'
        group by date_trunc('minute', created_at), vars->>'title', vars->>'message'
        order by max(created_at) desc
        limit 8
      ) b
    )
  );
end $$;

revoke execute on function public.admin_ops_overview() from public, anon;
grant execute on function public.admin_ops_overview() to authenticated, service_role;
