import { invoiceTotals, lineTotal, nextStatuses, parsePercentBp, parseQty, qtyText } from '@/lib/invoice';
import { loanSchedule } from '@/lib/loan';
import { esc, invoiceHtml, reportHtml } from '@/lib/pdf/html';
import { pdfName } from '@/lib/pdf/share';
import { annualReport, applyBp, bpText, estimateId, estimateMy, estimateTr, progressive, terCategory, terRate, trWageMonths } from '@/lib/tax';
import type { Transaction } from '@/data/types';
import { SAMPLE_USD_RATES } from '@/lib/fx';

// Contoh dihitung manual; angka yang diharapkan ditulis di sini, bukan dihitung ulang dengan kode yang diuji.

describe('PPh 21 TER (Indonesia, 2026)', () => {
  it('TK/0, bruto Rp10.000.000/bulan, tanpa iuran pensiun', () => {
    // TER kategori A, 9.650.001 sampai 10.050.000 = 2% -> 200.000 per bulan (Jan sampai Nov).
    // Setahun: bruto 120.000.000 - biaya jabatan 6.000.000 (5%, maks 6 jt) = neto 114.000.000
    // PKP = 114.000.000 - PTKP TK/0 54.000.000 = 60.000.000 -> 5% = 3.000.000
    // Desember = 3.000.000 - 11 × 200.000 = 800.000
    const r = estimateId({ married: false, dependents: 0, monthlyGross: 10_000_000, monthlyPension: 0 });
    expect(r.headline).toBe(200_000);
    expect(r.annualTax).toBe(3_000_000);
    const dec = r.lines.find((l) => l.key === 'idDecember');
    expect(dec?.amount).toBe(800_000);
    expect(r.lines.find((l) => l.key === 'idPkp')?.amount).toBe(60_000_000);
  });

  it('K/2, bruto Rp25.000.000, iuran pensiun Rp500.000/bulan', () => {
    // Kategori B (K/2), 21.850.001 sampai 26.000.000 = 9% -> 2.250.000 per bulan.
    // Setahun: 300.000.000 - 6.000.000 - 6.000.000 = 288.000.000; PTKP K/2 = 54 + 4,5 + 9 = 67.500.000
    // PKP 220.500.000 -> 60 jt × 5% = 3.000.000 + 160,5 jt × 15% = 24.075.000 -> 27.075.000
    // Jan sampai Nov = 24.750.000 -> Desember 2.325.000
    const r = estimateId({ married: true, dependents: 2, monthlyGross: 25_000_000, monthlyPension: 500_000 });
    expect(r.headline).toBe(2_250_000);
    expect(r.annualTax).toBe(27_075_000);
    expect(r.lines.find((l) => l.key === 'idDecember')?.amount).toBe(2_325_000);
  });

  it('kategori TER dan batas tabel', () => {
    expect(terCategory({ married: false, dependents: 1 })).toBe('A');
    expect(terCategory({ married: true, dependents: 0 })).toBe('A');
    expect(terCategory({ married: false, dependents: 2 })).toBe('B');
    expect(terCategory({ married: true, dependents: 2 })).toBe('B');
    expect(terCategory({ married: true, dependents: 3 })).toBe('C');
    expect(terRate('A', 5_400_000)).toBe(0);
    expect(terRate('A', 5_400_001)).toBe(25);
    expect(terRate('A', 2_000_000_000)).toBe(3400);
    expect(terRate('C', 6_600_000)).toBe(0);
  });

  it('pemotongan lebih besar dari pajak setahun -> lebih bayar', () => {
    const r = estimateId({ married: false, dependents: 0, monthlyGross: 6_000_000, monthlyPension: 0 });
    // TER A 5.950.001 sampai 6.300.000 = 0,75% -> 45.000; setahun 72 jt - 3,6 jt = 68,4 jt - PTKP 54 jt = PKP 14,4 jt × 5% = 720.000
    // Jan sampai Nov 495.000 -> Desember 225.000
    expect(r.headline).toBe(45_000);
    expect(r.annualTax).toBe(720_000);
    expect(r.lines.find((l) => l.key === 'idDecember')?.amount).toBe(225_000);
  });
});

describe('PCB/MTD (Malaysia, YA 2026)', () => {
  it('bujang, RM5.000/bulan, KWSP 11%', () => {
    // Setahun 60.000; KWSP 11% = 6.600 -> pelepasan maks 4.000; diri 9.000 -> bercukai 47.000
    // Cukai: 600 (sampai 35.000) + 12.000 × 6% = 720 -> 1.320; tanpa rebat (> 35.000)
    // PCB = 1.320 / 12 = RM110,00
    const r = estimateMy({ monthlyGross: 500_000, spouseRelief: false, children: 0, epf: true });
    expect(r.annualTax).toBe(132_000);
    expect(r.headline).toBe(11_000);
  });

  it('berkahwin (pasangan tidak bekerja), 2 anak, RM4.000/bulan', () => {
    // Setahun 48.000; KWSP 5.280 -> 4.000; diri 9.000; pasangan 4.000; anak 2 × 2.000 = 4.000 -> bercukai 27.000
    // Cukai: 150 + 7.000 × 3% = 210 -> 360; rebat 400 + 400 (<= 35.000) -> 0
    const r = estimateMy({ monthlyGross: 400_000, spouseRelief: true, children: 2, epf: true });
    expect(r.lines.find((l) => l.key === 'myChargeable')?.amount).toBe(2_700_000);
    expect(r.annualTax).toBe(0);
    expect(r.headline).toBe(0);
  });
});

describe('Gelir Vergisi (Turki, 2026)', () => {
  it('brüt 50.000 TL/bulan', () => {
    // SGK 14% + işsizlik 1% = 7.500 -> matrah 42.500/bulan, 510.000 setahun
    // Pajak: 190.000 × 15% = 28.500; 210.000 × 20% = 42.000 (70.500 sampai 400.000); 110.000 × 27% = 29.700 -> 100.200
    // Istisna asgari ücret: matrah 33.030 × 85% = 28.075,50 × 12 = 336.906 -> 28.500 + 146.906 × 20% = 57.881,20
    // Dibayar setahun = 100.200 - 57.881,20 = 42.318,80
    const r = estimateTr({ monthlyGross: 5_000_000 });
    expect(r.lines.find((l) => l.key === 'trTax')?.amount).toBe(10_020_000);
    expect(r.lines.find((l) => l.key === 'trExemption')?.amount).toBe(5_788_120);
    expect(r.annualTax).toBe(4_231_880);
  });

  it('istisna asgari ücret per bulan sesuai angka resmi 2026 (4.211,33 / Juli 4.537,75 / Agustus 5.615,10)', () => {
    const { months } = trWageMonths(10_000_000);
    expect(months[0].exemption).toBe(421_133);
    expect(months[6].exemption).toBe(453_775);
    expect(months[7].exemption).toBe(561_510);
  });

  it('gaji asgari ücret: pajak nol setelah istisna', () => {
    expect(estimateTr({ monthlyGross: 3_303_000 }).annualTax).toBe(0);
  });
});

describe('bantuan pajak', () => {
  it('progresif dan bp', () => {
    expect(progressive(100, [{ upTo: 50, bp: 1000 }, { upTo: null, bp: 2000 }])).toBe(15);
    expect(applyBp(1_000_000, 25)).toBe(2500);
    expect(bpText(25)).toBe('0,25');
    expect(bpText(1500, '.')).toBe('15');
    expect(bpText(750, '.')).toBe('7.5');
  });

  it('laporan tahunan dari transaksi: transfer dan tahun lain dilewati, kurs dikonversi', () => {
    const tx = (p: Partial<Transaction>): Transaction => ({
      id: Math.random().toString(), type: 'income', merchant: '', categoryKey: 'salary', accountId: 'a', date: '2026-03-01', time: '00:00', amount: 0, currency: 'IDR', source: 'manual', ...p,
    });
    const r = annualReport(
      [
        tx({ amount: 80_000_000 }),
        tx({ amount: 20_000_000, categoryKey: 'freelance', date: '2026-07-10' }),
        tx({ type: 'expense', amount: 5_000_000, categoryKey: 'food' }),
        tx({ type: 'transfer', amount: 9_999_999, toAccountId: 'b' }),
        tx({ amount: 1_000_000, date: '2025-12-31' }),
        tx({ amount: 100, currency: 'XXX' }),
      ],
      2026, 'ID', { married: false, dependents: 0 }, SAMPLE_USD_RATES,
    );
    expect(r.income).toBe(100_000_000);
    expect(r.expense).toBe(5_000_000);
    expect(r.skipped).toBe(1);
    expect(r.byCategory[0]).toEqual({ key: 'salary', amount: 80_000_000 });
    expect(r.months[6].income).toBe(20_000_000);
    // 100 jt - PTKP 54 jt = 46 jt × 5% = 2,3 jt
    expect(r.tax).toBe(2_300_000);
  });
});

describe('kalkulator cicilan', () => {
  it('anuitas: Rp100.000.000, 12%/tahun, 12 bulan', () => {
    // r = 1%; cicilan = 100 jt × 0,01 / (1 - 1,01^-12) = 8.884.878,79 -> 8.884.879
    const r = loanSchedule(100_000_000, 1200, 12, 'annuity');
    expect(r.monthly).toBe(8_884_879);
    expect(r.totalPaid - r.totalInterest).toBe(100_000_000);
    expect(Math.abs(r.totalInterest - 6_618_548)).toBeLessThanOrEqual(6);
  });

  it('flat: RM10.000, 5%/tahun, 24 bulan', () => {
    // Bunga = 10.000 × 5% × 2 = 1.000; total 11.000 / 24 = 458,33 (bulan terakhir 458,41)
    const r = loanSchedule(1_000_000, 500, 24, 'flat');
    expect(r.totalInterest).toBe(100_000);
    expect(r.monthly).toBe(45_833);
    expect(r.last).toBe(45_841);
    expect(r.totalPaid).toBe(1_100_000);
  });

  it('bunga 0%', () => {
    const r = loanSchedule(1_200_000, 0, 12, 'annuity');
    expect([r.monthly, r.totalInterest]).toEqual([100_000, 0]);
  });
});

describe('invoice', () => {
  it('jumlah sama dengan trigger server (qty pecahan, diskon, pajak 11%)', () => {
    const items = [{ qty: 1.5, unitPrice: 333_333 }, { qty: 2, unitPrice: 150_000 }];
    expect(lineTotal(items[0])).toBe(500_000);
    expect(invoiceTotals(items, 50_000, 1100)).toEqual({ subtotal: 800_000, discount: 50_000, tax: 82_500, total: 832_500 });
    expect(invoiceTotals([{ qty: 1, unitPrice: 1000 }], 5000, 0).discount).toBe(1000);
  });

  it('parse qty dan persen', () => {
    expect(parseQty('1,5')).toBe(1.5);
    expect(parseQty('0.333')).toBeNull();
    expect(parseQty('0')).toBeNull();
    expect(parsePercentBp('11')).toBe(1100);
    expect(parsePercentBp('7,5')).toBe(750);
    expect(parsePercentBp('101')).toBeNull();
    expect(qtyText(2.25, ',')).toBe('2,25');
  });

  it('status: Dibayar terakhir, penawaran tidak bisa dibayar', () => {
    expect(nextStatuses('invoice', 'draft')).toEqual(['sent', 'paid']);
    expect(nextStatuses('invoice', 'paid')).toEqual([]);
    expect(nextStatuses('quote', 'sent')).toEqual(['draft', 'accepted']);
  });

  it('HTML PDF meng-escape isi pengguna', () => {
    expect(esc('<b>"A&B"</b>')).toBe('&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;');
    const html = invoiceHtml({
      lang: 'id', accent: '#C8102E', docType: 'INVOICE', number: 'INV-2026-0001', sender: 'Sari', billTo: { label: 'Kepada', name: '<script>x</script>' },
      meta: [['Tanggal', '10 Nov 2026']], columns: { item: 'Item', qty: 'Qty', price: 'Harga', amount: 'Jumlah' },
      items: [{ name: 'Desain', qty: '1', price: 'Rp 1.000', amount: 'Rp 1.000' }], totals: [['Subtotal', 'Rp 1.000']], grand: ['Total', 'Rp 1.000'], footer: 'Arshif',
    });
    expect(html).not.toContain('<script>x');
    expect(html).toContain('INV-2026-0001');
    const report = reportHtml({ lang: 'id', accent: 'red; } body {', title: 'Laporan', subtitle: 'x', owner: 'y', blocks: [{ kind: 'table', columns: ['a'], numeric: [false], rows: [], empty: 'Kosong' }], disclaimer: 'Estimasi', footer: 'f' });
    expect(report).toContain('--accent: #1c1915');
    expect(report).toContain('Kosong');
    expect(pdfName('INV-2026-0001')).toBe('INV-2026-0001.pdf');
    expect(pdfName('Laporan Nov/2026')).toBe('Laporan-Nov-2026.pdf');
  });
});
