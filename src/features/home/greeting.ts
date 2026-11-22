import type { MsgKey } from '@/i18n';

/**
 * Sapaan Beranda yang tidak monoton: judul pendek menurut jam, dan kalimat kontekstual menurut jam, akhir pekan,
 * hari gajian, atau 1-2 hari menjelang gajian. Pilihan stabil selama satu hari (tidak berganti tiap layar dibuka),
 * berganti di hari berikutnya.
 */
export type Slot = 'late' | 'morning' | 'afternoon' | 'evening' | 'night';
export type Context = Slot | 'weekend' | 'payday' | 'paydaySoon';

const SLOTS: Slot[] = ['late', 'morning', 'afternoon', 'evening', 'night'];

export function slotOf(hour: number): Slot {
  if (hour < 4) return 'late';
  if (hour < 11) return 'morning';
  if (hour < 15) return 'afternoon';
  if (hour < 18) return 'evening';
  return 'night';
}

/** Hari menuju tanggal gajian berikutnya (0 = hari ini). Tanggal gajian 1-28, selalu ada di tiap bulan. */
export function daysToPayday(now: Date, payday: number): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(now.getFullYear(), now.getMonth(), payday);
  if (next < today) next = new Date(now.getFullYear(), now.getMonth() + 1, payday);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

export function contextOf(now: Date, payday: number): Context {
  const until = daysToPayday(now, payday);
  if (until === 0) return 'payday';
  if (until <= 2) return 'paydaySoon';
  const slot = slotOf(now.getHours());
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  // Akhir pekan hanya di siang hari; malam dan dini hari tetap memakai kalimat jamnya.
  if (weekend && slot !== 'late' && slot !== 'night') return 'weekend';
  return slot;
}

/** Satu pilihan per hari per kategori: hari lokal (bukan UTC) + garam agar judul dan kalimat tidak selalu sejajar. */
export function pickDaily<T>(list: T[], now: Date, salt: number): T {
  const day = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86_400_000);
  const i = (((day * 7 + salt * 13) % list.length) + list.length) % list.length;
  return list[i]!;
}

/** Katalog menyimpan beberapa variasi dalam satu string dipisah "|" (katalog hanya berisi string). */
export function greetingLines(
  t: (key: MsgKey) => string,
  now: Date,
  payday: number,
  name: string,
): { title: string; nudge: string } {
  const slot = slotOf(now.getHours());
  const first = name.split(/\s+/)[0] ?? '';
  const titles = t(`home.hello.${slot}`).split('|').filter((s) => first || !s.includes('{name}'));
  const ctx = contextOf(now, payday);
  const nudges = t(`home.nudge.${ctx}`).split('|');
  return {
    title: pickDaily(titles, now, SLOTS.indexOf(slot)).replace('{name}', first),
    nudge: pickDaily(nudges, now, 5),
  };
}
