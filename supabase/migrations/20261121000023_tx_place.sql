-- Lokasi transaksi: tempat beli dari struk/ucapan (tebakan AI), GPS, atau dicari sendiri lewat Google Places.
-- Semua opsional; koordinat selalu berpasangan.

alter table public.transactions
  add column place_name text check (char_length(place_name) <= 120),
  add column place_address text check (char_length(place_address) <= 240),
  add column place_lat double precision check (place_lat between -90 and 90),
  add column place_lng double precision check (place_lng between -180 and 180),
  add column place_id text check (char_length(place_id) <= 300),
  add constraint place_shape check (
    (place_lat is null and place_lng is null and place_name is null and place_address is null and place_id is null)
    or (place_lat is not null and place_lng is not null and place_name is not null)
  );

grant insert (place_name, place_address, place_lat, place_lng, place_id) on public.transactions to authenticated;
grant update (place_name, place_address, place_lat, place_lng, place_id) on public.transactions to authenticated;

-- Batas panggilan Google Places per pengguna (biaya per request): terpisah dari ai_jobs supaya
-- mengetik di kolom cari tidak menghabiskan rate limit scan/voice.
create table public.place_lookups (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index place_lookups_user_idx on public.place_lookups (user_id, created_at desc);
alter table public.place_lookups enable row level security;

-- false = batas tercapai. Dicatat dalam satu transaksi berkunci per pengguna (tidak bisa dibalap paralel).
create function public.place_lookup_start(p_user uuid, p_per_min integer default 30, p_per_day integer default 300) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('place_rate:' || p_user::text));
  if (select count(*) from public.place_lookups where user_id = p_user and created_at >= now() - interval '1 minute') >= p_per_min
     or (select count(*) from public.place_lookups where user_id = p_user and created_at >= now() - interval '1 day') >= p_per_day then
    return false;
  end if;
  delete from public.place_lookups where user_id = p_user and created_at < now() - interval '1 day';
  insert into public.place_lookups (user_id) values (p_user);
  return true;
end $$;
revoke execute on function public.place_lookup_start(uuid, integer, integer) from public, anon, authenticated;
