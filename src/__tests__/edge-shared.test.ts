import { CoachRequest, ImportRequest, ScanRequest, ScanResult, VoiceRequest } from '../../supabase/functions/_shared/contracts.ts';
import { cleanText, decimalToMinor, EXPONENTS, normalizeCurrency, positiveMinor } from '../../supabase/functions/_shared/money.ts';
import { normalizeCoach, normalizeScan, normalizeStatement, normalizeVoice } from '../../supabase/functions/_shared/normalize.ts';
import { CURRENCIES } from '@/lib/money';

const UID = '3f1c2b8e-7d4a-4c1e-9b2f-0a1b2c3d4e5f';
const ACC = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c9d';

describe('decimalToMinor (string desimal unit besar -> unit terkecil, tanpa float)', () => {
  it.each([
    ['45000', 'IDR', 45000],
    ['12.50', 'MYR', 1250],
    ['12.5', 'MYR', 1250],
    ['350.00', 'TRY', 35000],
    ['0.10', 'USD', 10],
    ['12.505', 'MYR', 1251],
    ['12.504', 'MYR', 1250],
    ['45000.4', 'IDR', 45000],
    ['45000.5', 'IDR', 45001],
    ['1234567.89', 'USD', 123456789],
    ['-28000', 'IDR', -28000],
    ['7', 'CHF', 700],
  ])('%s %s -> %d', (s, c, n) => expect(decimalToMinor(s, c)).toBe(n));

  it.each(['45.000,00', 'Rp 45.000', '1,250', 'abc', '', '1e5', '12.', '.5', '9999999999999999'])('menolak format ambigu "%s"', (s) => {
    expect(decimalToMinor(s, 'IDR')).toBeNull();
  });

  it('IDR "45.000" (pemisah ribuan gaya Indonesia) ditolak, bukan dibaca 45', () => {
    expect(decimalToMinor('45.000', 'IDR')).toBeNull();
    expect(decimalToMinor('45.000', 'MYR')).toBe(4500);
  });

  it('positiveMinor menolak nol dan negatif', () => {
    expect(positiveMinor('0', 'IDR')).toBeNull();
    expect(positiveMinor('-5', 'IDR')).toBeNull();
  });

  it('tabel eksponen server sama dengan klien (src/lib/money.ts)', () => {
    for (const [code, meta] of Object.entries(CURRENCIES)) expect([code, EXPONENTS[code]]).toEqual([code, meta.exponent]);
  });
});

describe('normalizeCurrency', () => {
  it.each([['Rp', 'IDR'], ['RM', 'MYR'], ['₺', 'TRY'], ['TL', 'TRY'], ['$', 'USD'], ['S$', 'SGD'], ['€', 'EUR'], ['myr', 'MYR'], ['??', 'IDR'], [null, 'IDR']])(
    '%s -> %s',
    (raw, code) => expect(normalizeCurrency(raw as string | null, 'IDR')).toBe(code),
  );
});

describe('normalizeScan', () => {
  const raw = {
    merchant: 'Indomaret Kemang Raya',
    date: '2026-11-05',
    time: '08:14',
    currency: 'Rp',
    subtotal: '87500',
    tax: null,
    service: null,
    discount: '0',
    total: '87500',
    items: [
      { name: 'Indomie Goreng', qty: '5', unitPrice: '3500', total: '17500' },
      { name: 'Telur Ayam 1 kg', qty: '1', total: '29000' },
      { name: '', qty: '1', total: '1000' },
      { name: 'Rusak', qty: '1', total: 'tidak terbaca' },
    ],
    categoryKey: 'groceries',
    confidence: { merchant: 0.95, date: 1.4, total: 0.9, items: '0.6' },
  };

  it('mengubah ke unit terkecil dan lolos kontrak', () => {
    const s = normalizeScan(raw)!;
    expect(ScanResult.safeParse(s).success).toBe(true);
    expect(s.currency).toBe('IDR');
    expect(s.total).toBe(87500);
    expect(s.discount).toBe(0);
    expect(s.items).toEqual([
      { name: 'Indomie Goreng', qty: 5, unitPrice: 3500, total: 17500 },
      { name: 'Telur Ayam 1 kg', qty: 1, unitPrice: 29000, total: 29000 },
    ]);
    expect(s.confidence).toEqual({ merchant: 0.95, date: 1, total: 0.9, items: 0.6 });
  });

  it('total kosong = tidak terbaca (null), kuota dikembalikan pemanggil', () => {
    expect(normalizeScan({ ...raw, total: null })).toBeNull();
    expect(normalizeScan({ ...raw, total: '0' })).toBeNull();
    expect(normalizeScan(null)).toBeNull();
  });

  it('kategori tak dikenal jadi other, tanggal salah jadi null, em dash dibuang', () => {
    const s = normalizeScan({ ...raw, categoryKey: 'crypto', date: '05/11/2026', merchant: 'Kopi — Tuku' })!;
    expect([s.categoryKey, s.date, s.merchant]).toEqual(['other', null, 'Kopi, Tuku']);
  });
});

describe('normalizeVoice', () => {
  const ctx = { accountIds: [ACC], defaultCurrency: 'IDR', today: '2026-11-05' };
  it('akun hanya dari daftar milik pengguna; selain itu null + petunjuk', () => {
    const v = normalizeVoice(
      {
        transcript: 'Tadi makan siang goceng pakai GoPay, terus bensin 150 ribu cash',
        items: [
          { type: 'expense', merchant: 'Makan siang', amount: '5000', currency: 'IDR', accountId: ACC, categoryKey: 'food', date: '2026-11-05' },
          { type: 'expense', merchant: 'Isi bensin', amount: '150000', currency: '', accountId: 'bukan-milikku', accountHint: 'cash', categoryKey: 'fuel', date: 'kemarin' },
          { type: 'expense', merchant: 'Tanpa nominal', amount: 'banyak', categoryKey: 'food', date: '2026-11-05' },
        ],
      },
      ctx,
    );
    expect(v.items).toHaveLength(2);
    expect(v.items[0]).toMatchObject({ amount: 5000, accountId: ACC, accountHint: null });
    expect(v.items[1]).toMatchObject({ amount: 150000, currency: 'IDR', accountId: null, accountHint: 'cash', date: '2026-11-05' });
  });

  it('keluaran kosong tetap valid', () => {
    expect(normalizeVoice({}, ctx)).toEqual({ transcript: '', items: [] });
  });
});

describe('normalizeStatement', () => {
  it('nominal negatif jadi positif, baris rusak dibuang', () => {
    const r = normalizeStatement(
      {
        pages: 2,
        rows: [
          { date: '2026-10-25', description: 'TRSF E-BANKING CR GAJI', type: 'income', amount: '14250000', currency: 'IDR', categoryKey: 'salary' },
          { date: '2026-10-26', description: 'QRIS KOPI', type: 'expense', amount: '-32000', currency: 'IDR', categoryKey: 'hangout' },
          { date: '26/10', description: 'tanpa tanggal', type: 'expense', amount: '1000', currency: 'IDR', categoryKey: 'other' },
          { date: '2026-10-27', description: '', type: 'expense', amount: '1000', currency: 'IDR', categoryKey: 'other' },
        ],
      },
      'IDR',
    );
    expect(r.pages).toBe(2);
    expect(r.rows.map((x) => [x.type, x.amount])).toEqual([['income', 14250000], ['expense', 32000]]);
  });
});

describe('normalizeCoach', () => {
  it('tepat 3 aksi, tanpa em dash', () => {
    const c = normalizeCoach({ narration: 'Skormu 72 — naik dari minggu lalu.', actions: ['Satu', 'Dua', 'Tiga', 'Empat'] })!;
    expect(c.narration).toBe('Skormu 72, naik dari minggu lalu.');
    expect(c.actions).toEqual(['Satu', 'Dua', 'Tiga']);
  });
  it('kurang dari 3 aksi ditolak', () => expect(normalizeCoach({ narration: 'x', actions: ['a'] })).toBeNull());
});

describe('kontrak request', () => {
  it('path storage harus "<uuid>/<berkas>" tanpa traversal', () => {
    expect(ScanRequest.safeParse({ path: `${UID}/struk-1.jpg`, lang: 'id' }).success).toBe(true);
    for (const path of [`${UID}/../x.jpg`, `../${UID}/x.jpg`, 'x.jpg', `${UID}/a/b.jpg`]) {
      expect([path, ScanRequest.safeParse({ path, lang: 'id' }).success]).toEqual([path, false]);
    }
  });

  it('bahasa hanya id/ms/tr/en', () => expect(ScanRequest.safeParse({ path: `${UID}/a.jpg`, lang: 'fr' }).success).toBe(false));

  it('voice: mime audio terbatas, akun berbentuk uuid', () => {
    const ok = { audio: 'A'.repeat(32), mimeType: 'audio/mp4', lang: 'ms', today: '2026-11-05', timezone: 'Asia/Kuala_Lumpur', defaultCurrency: 'MYR', accounts: [{ id: ACC, name: 'Maybank', bank: 'maybank', currency: 'MYR' }] };
    expect(VoiceRequest.safeParse(ok).success).toBe(true);
    expect(VoiceRequest.safeParse({ ...ok, mimeType: 'video/mp4' }).success).toBe(false);
    expect(VoiceRequest.safeParse({ ...ok, accounts: [{ ...ok.accounts[0], id: 'a-bca' }] }).success).toBe(false);
  });

  it('import butuh accountId uuid', () => {
    expect(ImportRequest.safeParse({ path: `${UID}/rk.pdf`, accountId: ACC, lang: 'id' }).success).toBe(true);
    expect(ImportRequest.safeParse({ path: `${UID}/rk.pdf`, accountId: 'a-bca', lang: 'id' }).success).toBe(false);
  });

  it('coach hanya menerima ringkasan angka dengan 5 pilar', () => {
    const pillars = ['savings', 'budget', 'debt', 'emergency', 'bills'].map((key) => ({ key, points: 10, max: 20 }));
    const ok = { lang: 'tr', weekStart: '2026-10-26', score: 72, pillars, facts: { spentChangePct: -12, topCategoryKey: 'food', noSpendDays: 2, budgetUsedPct: 54, periodElapsedPct: 37 } };
    expect(CoachRequest.safeParse(ok).success).toBe(true);
    expect(CoachRequest.safeParse({ ...ok, pillars: pillars.slice(0, 4) }).success).toBe(false);
    expect(CoachRequest.safeParse({ ...ok, facts: { ...ok.facts, merchant: 'Kopi Tuku' } }).data?.facts).not.toHaveProperty('merchant');
  });

  it('cleanText merapikan spasi dan dash', () => expect(cleanText('  a  –  b ')).toBe('a, b'));
});
