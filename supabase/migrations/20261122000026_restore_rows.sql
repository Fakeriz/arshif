-- Pulihkan cadangan (Pengaturan > Cadangan): upsert baris ke tabel data pengguna. SECURITY DEFINER karena id asli
-- harus ikut dipulihkan (beberapa tabel tidak memberi izin tulis kolom id ke klien), dengan pengaman yang setara RLS
-- tabel-tabel ini (semuanya hanya user_id = auth.uid()):
--   * user_id SELALU auth.uid(); update hanya bila baris yang ada milik pengguna yang sama;
--   * kolom dibatasi ke kolom yang boleh ditulis klien (izin INSERT/UPDATE) + id; kolom turunan (accounts.balance) tidak ikut;
--   * trigger kepemilikan (transaksi -> akun) dan kuota paket tetap berjalan;
--   * tabel dikunci ke daftar di bawah (paket, kuota, pesanan, profil tidak bisa).
-- Baris yang gagal dilewati dan dihitung, bukan membatalkan semua.
create or replace function public.restore_rows(p_table text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_conflict text;
  v_ins text;
  v_ins_cols text[];
  v_upd_cols text[];
  v_upd text;
  v_sql text;
  r jsonb;
  n int;
  ok int := 0;
  skipped int := 0;
  v_err text;
begin
  if v_uid is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;
  v_conflict := case p_table
    when 'user_rates' then 'user_id, code'
    when 'net_worth_snapshots' then 'user_id, date'
    when 'budgets' then 'user_id, period_start'
    when 'accounts' then 'id' when 'limit_groups' then 'id' when 'transactions' then 'id'
    when 'transaction_items' then 'id' when 'goals' then 'id' when 'goal_deposits' then 'id'
    when 'debts' then 'id' when 'debt_payments' then 'id' when 'bills' then 'id'
    when 'subscriptions' then 'id' when 'split_bills' then 'id' when 'invoices' then 'id'
    when 'assets' then 'id' when 'asset_price_alerts' then 'id'
  end;
  if v_conflict is null then
    raise exception 'restore_table_not_allowed' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 500 then
    raise exception 'restore_bad_rows' using errcode = 'P0001';
  end if;

  -- Kolom yang boleh ditulis klien (izin INSERT/UPDATE) + id; tanpa kolom generated dan tanpa user_id (selalu auth.uid()).
  -- Kolom turunan seperti accounts.balance tidak punya izin tulis, jadi otomatis tidak ikut.
  select array_agg(c.column_name::text) into v_ins_cols
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = p_table and c.is_generated = 'NEVER' and c.column_name <> 'user_id'
    and (c.column_name = 'id' or exists (
      select 1 from information_schema.role_column_grants g
      where g.table_schema = 'public' and g.table_name = p_table and g.column_name = c.column_name
        and g.privilege_type = 'INSERT' and g.grantee in ('authenticated', 'PUBLIC')));
  select array_agg(c.column_name::text) into v_upd_cols
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = p_table and c.is_generated = 'NEVER'
    and c.column_name not in ('id', 'user_id') and c.column_name <> all (string_to_array(replace(v_conflict, ' ', ''), ','))
    and exists (select 1 from information_schema.role_column_grants g
                where g.table_schema = 'public' and g.table_name = p_table and g.column_name = c.column_name
                  and g.privilege_type = 'UPDATE' and g.grantee in ('authenticated', 'PUBLIC'));

  for r in select * from jsonb_array_elements(p_rows) loop
    begin
      -- Hanya kolom yang ADA di baris: kolom yang tidak ada (cadangan lama, kolom baru) memakai default tabel, bukan NULL.
      select string_agg(quote_ident(k), ', ') into v_ins from jsonb_object_keys(r) k where k = any (v_ins_cols);
      select string_agg(format('%1$I = excluded.%1$I', k), ', ') into v_upd from jsonb_object_keys(r) k where k = any (v_upd_cols);
      if v_ins is null then
        raise exception 'restore_empty_row';
      end if;
      v_sql := format(
        'insert into public.%1$I as t (user_id, %2$s) select $2, %2$s from jsonb_populate_record(null::public.%1$I, $1) '
        'on conflict (%3$s) do %4$s',
        p_table, v_ins, v_conflict, coalesce('update set ' || v_upd || ' where t.user_id = $2', 'nothing'));
      execute v_sql using r, v_uid;
      get diagnostics n = row_count;
      -- 0 baris = id sudah dipakai pengguna lain (update dicegah where) atau tabel tanpa izin update: dilewati.
      if n = 1 then ok := ok + 1; else skipped := skipped + 1; end if;
    exception when others then
      -- Kuota paket, referensi ke data yang tidak ada/milik orang lain: lewati baris ini saja.
      skipped := skipped + 1;
      v_err := coalesce(v_err, sqlerrm);
    end;
  end loop;
  return jsonb_build_object('restored', ok, 'skipped', skipped, 'first_error', v_err);
end;
$$;

revoke all on function public.restore_rows(text, jsonb) from public, anon;
grant execute on function public.restore_rows(text, jsonb) to authenticated;
