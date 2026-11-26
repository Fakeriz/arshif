import type { SplitItem, SplitParticipant } from '@/data/planning';

export type SplitInput = {
  mode: 'equal' | 'items';
  /** Total tagihan yang harus terbagi habis. */
  total: number;
  participants: Pick<SplitParticipant, 'id' | 'owner'>[];
  /** Per item: harga (sudah termasuk diskonnya) dan peserta yang ikut menanggung. */
  items: Pick<SplitItem, 'amount' | 'assigned'>[];
};

/**
 * Bagian tiap peserta (unit terkecil), jumlahnya selalu = total.
 * - Rata: total / jumlah peserta.
 * - Per item: harga item dibagi rata ke peserta yang ditetapkan (item tanpa peserta = pemilik), lalu selisih
 *   total dan jumlah item (pajak, service charge) dibagi proporsional ke subtotal masing-masing.
 * Semua sisa pembulatan dibebankan ke pemilik.
 */
export function computeShares(input: SplitInput): Record<string, number> {
  const { participants, total } = input;
  const shares: Record<string, number> = Object.fromEntries(participants.map((p) => [p.id, 0]));
  if (participants.length === 0) return shares;
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.trunc(total)) : 0;
  if (safeTotal === 0) return shares;
  const owner = participants.find((p) => p.owner)?.id ?? participants[0].id;

  if (input.mode === 'equal') {
    const each = Math.floor(safeTotal / participants.length);
    for (const p of participants) shares[p.id] = each;
  } else {
    const known = new Set(participants.map((p) => p.id));
    for (const it of input.items) {
      const amt = Number.isFinite(it.amount) ? Math.max(0, Math.trunc(it.amount)) : 0;
      if (amt === 0) continue;
      const who = it.assigned.filter((id) => known.has(id));
      const takers = who.length ? who : [owner];
      const each = Math.floor(amt / takers.length);
      for (const id of takers) shares[id] += each;
      shares[owner] += amt - each * takers.length;
    }
    const itemsSum = Object.values(shares).reduce((s, v) => s + v, 0);
    const extra = safeTotal - itemsSum;
    if (extra !== 0 && itemsSum > 0) {
      const base = { ...shares };
      // BigInt: extra × subtotal bisa melewati 2^53 untuk tagihan besar dalam rupiah.
      for (const p of participants) shares[p.id] += Number((BigInt(extra) * BigInt(base[p.id])) / BigInt(itemsSum));
    }
  }
  let rem = safeTotal - Object.values(shares).reduce((s, v) => s + v, 0);
  if (rem < 0 && shares[owner] + rem < 0) {
    rem += shares[owner];
    shares[owner] = 0;
    for (const p of participants) {
      if (rem >= 0) break;
      const take = Math.min(shares[p.id], -rem);
      shares[p.id] -= take;
      rem += take;
    }
  } else {
    shares[owner] += rem;
  }
  return shares;
}

/** Ringkasan teks untuk dibagikan (WhatsApp, dsb.). Label sudah diterjemahkan pemanggil. */
export function shareText(lines: { title: string; total: string; people: { name: string; amount: string; paid: boolean }[]; paidLabel: string; unpaidLabel: string; totalLabel: string }): string {
  const rows = lines.people.map((p) => `- ${p.name}: ${p.amount} (${p.paid ? lines.paidLabel : lines.unpaidLabel})`);
  return [lines.title, `${lines.totalLabel}: ${lines.total}`, '', ...rows].join('\n');
}
