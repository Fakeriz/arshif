-- Import PDF struk: bucket receipts juga menerima PDF (struk elektronik). Batas ukuran tetap 8 MB.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'application/pdf']
where id = 'receipts';
