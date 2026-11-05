/** Kategori awal untuk baris rekening koran dari kata kunci deskripsi. Pengguna bisa mengubahnya setelah import. */
const RULES: [RegExp, string][] = [
  [/apotek|klinik|rumah sakit|dokter/i, 'health'],
  [/sewa|kos|kontrak/i, 'housing'],
  [/listrik|pln|pdam|air/i, 'utilities'],
  [/pulsa|data|telkomsel|indosat|xl/i, 'phone'],
  [/adm|biaya|bunga|pajak/i, 'bank'],
  [/gaji|salary|payroll/i, 'salary'],
  [/indomaret|alfamart|supermarket|hypermart/i, 'groceries'],
  [/gojek|grab|transjakarta|krl/i, 'transport'],
];

export function categorizeStatementRow(description: string, type: 'income' | 'expense'): string {
  const hit = RULES.find(([re]) => re.test(description));
  if (hit && (type === 'expense' ? hit[1] !== 'salary' : true)) return hit[1];
  return 'other';
}

/** "APOTEK K-24 KEMANG" -> "Apotek K-24 Kemang" agar enak dibaca di daftar transaksi. */
export function prettifyDescription(description: string): string {
  return description.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bTrf\b/, 'Transfer');
}
