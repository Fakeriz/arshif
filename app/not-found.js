export default function NotFound() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 text-center bg-background text-foreground">
      <h2 className="text-xl font-bold">Halaman Tidak Ditemukan</h2>
      <p className="text-sm text-muted-foreground mt-2">Halaman yang Anda cari tidak tersedia.</p>
      <a href="/" className="mt-4 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-semibold">
        Kembali ke Beranda
      </a>
    </div>
  )
}
