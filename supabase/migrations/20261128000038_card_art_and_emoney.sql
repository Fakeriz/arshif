-- Jenis akun baru 'emoney' + perluasan format card_style (motif baru, finish material, dan foto kartu pribadi).
alter table public.accounts
  drop constraint if exists accounts_type_check,
  add constraint accounts_type_check check (
    type in ('tabungan', 'cash', 'ewallet', 'emoney', 'kartu_kredit', 'paylater')
  );

alter table public.accounts
  drop constraint if exists accounts_card_style_check,
  add constraint accounts_card_style_check check (
    card_style is null
    or card_style ~ '^[a-z0-9-]{1,80}$'
    or card_style ~ '^(obsidian|titanium|monokrom):[a-z0-9-]{1,64}$'
    or card_style ~ '^photo:[0-9a-f-]{36}/[A-Za-z0-9._-]{1,120}$'
  );

-- Path foto kartu harus berada di folder pengguna sendiri di bucket avatars (<user_id>/<berkas>).
create or replace function public.accounts_check_card_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.card_style is not null
     and new.card_style like 'photo:%'
     and split_part(substring(new.card_style from 7), '/', 1) <> new.user_id::text then
    raise exception 'card_photo_not_owned' using errcode = '42501';
  end if;
  return new;
end $$;

revoke execute on function public.accounts_check_card_photo() from public, anon, authenticated;

drop trigger if exists accounts_card_photo on public.accounts;
create trigger accounts_card_photo before insert or update on public.accounts
  for each row execute function public.accounts_check_card_photo();
