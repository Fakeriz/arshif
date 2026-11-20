/** "APOTEK K-24 KEMANG" -> "Apotek K-24 Kemang" agar enak dibaca di daftar transaksi. */
export function prettifyDescription(description: string): string {
  return description.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bTrf\b/, 'Transfer');
}
