-- Sampul profil: null = preset bawaan (tinta), "preset:<kunci>" = preset pilihan, selain itu path foto di bucket avatars.
alter table public.profiles add column cover_path text check (char_length(cover_path) <= 200);
grant update (cover_path) on public.profiles to authenticated;
