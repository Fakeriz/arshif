-- Foto profil: berkas di bucket privat avatars (<user_id>/<uuid>.jpg), dibaca lewat signed URL.
-- Path lain di kolom ini tidak berbahaya: signed URL dibuat dengan token pengguna, policy menolak folder orang lain.
alter table public.profiles add column avatar_path text check (char_length(avatar_path) <= 200);
grant update (avatar_path) on public.profiles to authenticated;

-- Klien sudah memotong persegi 512 px JPEG (±60 KB); 2 MB hanya batas aman.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy avatars_own_select on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_own_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_own_delete on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
