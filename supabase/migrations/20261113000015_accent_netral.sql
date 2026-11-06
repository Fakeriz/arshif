-- Arah desain "Monokrom" (docs/design.md): aksen netral menjadi pilihan dan default baru.
alter table public.profiles drop constraint if exists profiles_accent_check;
alter table public.profiles
  add constraint profiles_accent_check
  check (accent in ('netral', 'merah', 'kuningan', 'zamrud', 'biru', 'ungu'));
alter table public.profiles alter column accent set default 'netral';
