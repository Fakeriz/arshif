import type { Account, Transaction } from '@/data/types';
import { categoryLabel, type MsgKey, type TFunction } from '@/i18n';
import type { Lang } from '@/i18n/types';
import { monthName, shortDate, todayYmd } from '@/lib/dates';
import { tryConvert, usdRatesDate } from '@/lib/fx';
import { isReimbursable, reimbursementIncomeIds } from '@/lib/transactions';
import { invoiceTotals, qtyText, type Invoice } from '@/lib/invoice';
import { formatMoney } from '@/lib/money';
import { invoiceHtml, reportHtml, type ReportBlock } from '@/lib/pdf/html';
import { bpText, type AnnualReport } from '@/lib/tax';

/**
 * Menyusun dokumen PDF dari data aplikasi: invoice/penawaran (gratis), laporan bulanan, laporan pajak, dan riwayat
 * transaksi (PDF Export, Premium). Teks dari katalog i18n, nominal diformat per mata uang.
 */

type Ctx = { t: TFunction; lang: Lang; owner: string };

const decimal = (lang: Lang): ',' | '.' => (lang === 'id' || lang === 'tr' ? ',' : '.');
const generated = (c: Ctx) => c.t('tools.pdf.footer', { date: shortDate(todayYmd(), c.lang) });

export function invoiceDocument(inv: Invoice, c: Ctx): string {
  const { t, lang } = c;
  const money = (v: number) => formatMoney(v, inv.currency);
  const quote = inv.kind === 'quote';
  const totals = invoiceTotals(inv.items, inv.discount, inv.taxBp);
  const rows: [string, string][] = [[t('inv.doc.subtotal'), money(totals.subtotal)]];
  if (totals.discount > 0) rows.push([t('inv.doc.discount'), `− ${money(totals.discount)}`]);
  if (inv.taxBp > 0) rows.push([t('inv.doc.tax', { rate: bpText(inv.taxBp, decimal(lang)) }), money(totals.tax)]);
  const meta: [string, string][] = [[t('inv.doc.issued'), shortDate(inv.issueDate, lang)]];
  if (inv.dueDate) meta.push([quote ? t('inv.doc.validUntil') : t('inv.doc.due'), shortDate(inv.dueDate, lang)]);
  meta.push([t('inv.doc.currency'), inv.currency]);
  return invoiceHtml({
    lang,
    docType: quote ? t('inv.doc.quoteType') : t('inv.doc.invoiceType'),
    number: inv.number,
    status: inv.status === 'paid' ? t('inv.status.paid') : undefined,
    sender: c.owner,
    billTo: { label: quote ? t('inv.doc.preparedFor') : t('inv.doc.billTo'), name: inv.clientName, contact: inv.clientContact },
    meta,
    columns: { item: t('inv.doc.item'), qty: t('inv.doc.qty'), price: t('inv.doc.price'), amount: t('inv.doc.amount') },
    items: inv.items.map((i) => ({ name: i.name, qty: qtyText(i.qty, decimal(lang)), price: money(i.unitPrice), amount: money(lineOf(i)) })),
    totals: rows,
    grand: [t('inv.doc.total'), money(totals.total)],
    notes: inv.notes ? { label: t('inv.doc.notes'), text: inv.notes } : undefined,
    footer: generated(c),
  });
}

const lineOf = (i: Invoice['items'][number]) => invoiceTotals([i], 0, 0).subtotal;

export type InvoiceFiscalRow = {
  invoice: Invoice;
  fiscalDate: string;
  subtotal: number;
  tax: number;
  total: number;
};

export type InvoiceFiscalSummary = {
  rows: InvoiceFiscalRow[];
  paidCount: number;
  unpaidCount: number;
  paidSubtotal: number;
  paidTax: number;
  paidTotal: number;
  unpaidTotal: number;
  skipped: number;
};

/** Ringkasan invoice pada tahun fiskal tertentu dalam mata uang laporan pajak negara terpilih. */
export function invoiceFiscalSummary(invoices: Invoice[], year: number, targetCurrency: string): InvoiceFiscalSummary {
  const yearStr = String(year);
  const candidates = invoices
    .filter((inv) => {
      if (inv.kind !== 'invoice') return false;
      const fiscalDate = inv.status === 'paid' && inv.paidAt ? inv.paidAt.slice(0, 10) : inv.issueDate;
      return fiscalDate.startsWith(yearStr);
    })
    .sort((a, b) => a.issueDate.localeCompare(b.issueDate) || a.number.localeCompare(b.number));

  const rows: InvoiceFiscalRow[] = [];
  let paidCount = 0;
  let unpaidCount = 0;
  let paidSubtotal = 0;
  let paidTax = 0;
  let paidTotal = 0;
  let unpaidTotal = 0;
  let skipped = 0;

  for (const inv of candidates) {
    const fiscalDate = inv.status === 'paid' && inv.paidAt ? inv.paidAt.slice(0, 10) : inv.issueDate;
    const calc = invoiceTotals(inv.items, inv.discount, inv.taxBp);
    const sub = inv.currency === targetCurrency ? calc.subtotal : tryConvert(calc.subtotal, inv.currency, targetCurrency, inv.issueDate);
    const tax = inv.currency === targetCurrency ? calc.tax : tryConvert(calc.tax, inv.currency, targetCurrency, inv.issueDate);
    const tot = inv.currency === targetCurrency ? calc.total : tryConvert(calc.total, inv.currency, targetCurrency, inv.issueDate);
    if (sub === null || tax === null || tot === null) {
      skipped += 1;
      continue;
    }
    rows.push({ invoice: inv, fiscalDate, subtotal: sub, tax, total: tot });
    if (inv.status === 'paid') {
      paidCount += 1;
      paidSubtotal += sub;
      paidTax += tax;
      paidTotal += tot;
    } else {
      unpaidCount += 1;
      unpaidTotal += tot;
    }
  }

  return { rows, paidCount, unpaidCount, paidSubtotal, paidTax, paidTotal, unpaidTotal, skipped };
}

function annualReportBaseBlocks(r: AnnualReport, c: Ctx): { core: ReportBlock[]; notes: string[]; countryName: string } {
  const { t, lang } = c;
  const money = (v: number) => formatMoney(v, r.currency);
  const core: ReportBlock[] = [
    {
      kind: 'pairs', heading: t('tools.report.summary'),
      rows: [[t('tools.report.income'), money(r.income)], [t('tools.report.expense'), money(r.expense)], [t('tools.report.net'), money(r.income - r.expense)]],
    },
    {
      kind: 'table', heading: t('tools.report.byCategory'), columns: [t('tools.report.category'), t('tools.report.amount')], numeric: [false, true],
      rows: r.byCategory.map((x) => [categoryLabel(t, x.key), money(x.amount)]), empty: t('tools.report.noIncome'),
    },
    {
      kind: 'table', heading: t('tools.report.byMonth'), columns: [t('tools.report.month'), t('tools.report.income'), t('tools.report.expense')], numeric: [false, true, true],
      rows: r.months.map((m, i) => [monthName(i + 1, lang), money(m.income), money(m.expense)]),
    },
    {
      kind: 'pairs', heading: t('tools.report.estimate'), strongLast: true,
      rows: [
        [t('tools.report.income'), money(r.income)],
        ...(r.allowance > 0 ? [[t(`tools.report.allowance${r.country}` as MsgKey), `− ${money(r.allowance)}`] as [string, string]] : []),
        [t('tools.report.taxable'), money(r.taxable)],
        [t('tools.report.taxEstimate'), money(r.tax)],
      ],
    },
  ];
  const notes = [t(`tools.report.basis${r.country}` as MsgKey), t('tools.report.fxNote', { date: usdRatesDate() ? shortDate(usdRatesDate()!, lang) : '-' })];
  if (r.skipped > 0) notes.push(t('tools.report.skipped', { count: r.skipped }));
  const countryName = t(`tools.tax.country${r.country === 'ID' ? 'Id' : r.country === 'MY' ? 'My' : 'Tr'}` as MsgKey);
  return { core, notes, countryName };
}

/** Laporan pajak tahunan (FR-TAX-3), dengan disclaimer FR-TAX-4. */
export function annualReportDocument(r: AnnualReport, c: Ctx): string {
  const { t, lang } = c;
  const { core, notes, countryName } = annualReportBaseBlocks(r, c);
  const blocks: ReportBlock[] = [...core, { kind: 'pairs', heading: t('tools.report.assumptions'), rows: notes.map((n) => [n, '']) }];
  return reportHtml({
    lang, owner: c.owner,
    title: t('tools.report.docTitle', { year: r.year }),
    subtitle: t('tools.report.docSubtitle', { country: countryName, currency: r.currency }),
    blocks, disclaimer: t('tools.tax.disclaimer'), footer: generated(c),
  });
}

/** Paket bundel PDF multi-halaman: ringkasan pajak tahunan negara (ID/MY/TR) + daftar invoice & pajak keluaran (PPN/SST/KDV). */
export function fiscalBundleDocument(r: AnnualReport, invoices: Invoice[], c: Ctx): string {
  const { t, lang } = c;
  const money = (v: number) => formatMoney(v, r.currency);
  const { core, notes, countryName } = annualReportBaseBlocks(r, c);
  const invSum = invoiceFiscalSummary(invoices, r.year, r.currency);
  if (invSum.skipped > 0) notes.push(t('tools.report.skippedInvoices', { count: invSum.skipped }));

  const invoiceSummaryBlock: ReportBlock = {
    kind: 'pairs',
    heading: t('tools.report.invoiceSummary'),
    strongLast: true,
    rows: [
      [t('tools.report.invoicePaidCount'), String(invSum.paidCount)],
      [t('tools.report.invoicePaidSubtotal'), money(invSum.paidSubtotal)],
      [t('tools.report.invoiceOutputTax'), money(invSum.paidTax)],
      [t('tools.report.invoiceUnpaidTotal'), money(invSum.unpaidTotal)],
      [t('tools.report.invoicePaidTotal'), money(invSum.paidTotal)],
    ],
  };

  const invoiceTableBlock: ReportBlock = {
    kind: 'table',
    heading: t('tools.report.invoiceTable', { year: r.year }),
    columns: [
      t('tools.report.invoiceColNumber'),
      t('tools.report.invoiceColDate'),
      t('tools.report.invoiceColClient'),
      t('tools.report.invoiceColStatus'),
      t('tools.report.invoiceColTax'),
      t('tools.report.invoiceColTotal'),
    ],
    numeric: [false, false, false, false, true, true],
    rows: invSum.rows.map((x) => {
      const calc = invoiceTotals(x.invoice.items, x.invoice.discount, x.invoice.taxBp);
      return [
        x.invoice.number || t('inv.status.draft'),
        shortDate(x.fiscalDate, lang),
        x.invoice.clientName,
        t(`inv.status.${x.invoice.status}` as MsgKey),
        formatMoney(calc.tax, x.invoice.currency),
        formatMoney(calc.total, x.invoice.currency),
      ];
    }),
    empty: t('tools.report.invoiceEmpty'),
  };

  return reportHtml({
    lang,
    owner: c.owner,
    title: t('tools.report.bundleDocTitle', { year: r.year }),
    subtitle: t('tools.report.docSubtitle', { country: countryName, currency: r.currency }),
    blocks: [...core, invoiceSummaryBlock, invoiceTableBlock, { kind: 'pairs', heading: t('tools.report.assumptions'), rows: notes.map((n) => [n, '']) }],
    disclaimer: t('tools.tax.disclaimer'),
    footer: generated(c),
  });
}

/** Ringkasan satu bulan (YYYY-MM) dalam mata uang utama. */
export function monthlySummary(txs: Transaction[], month: string, main: string) {
  // Reimbursement bukan belanja dan penggantinya bukan pemasukan (FR-TRX-4).
  const repayments = reimbursementIncomeIds(txs);
  const inMonth = txs.filter((x) => x.date.startsWith(month) && x.type !== 'transfer' && !isReimbursable(x) && !repayments.has(x.id));
  let income = 0;
  let expense = 0;
  let skipped = 0;
  const byCat = new Map<string, { income: number; expense: number }>();
  for (const x of inMonth) {
    // Kurs pada tanggal transaksi (FR-FX-4).
    const v = tryConvert(x.amount, x.currency, main, x.date);
    if (v === null) {
      skipped++;
      continue;
    }
    const row = byCat.get(x.categoryKey) ?? { income: 0, expense: 0 };
    if (x.type === 'income') {
      income += v;
      row.income += v;
    } else {
      expense += v;
      row.expense += v;
    }
    byCat.set(x.categoryKey, row);
  }
  return { income, expense, count: inMonth.length, skipped, byCat: [...byCat.entries()].map(([key, v]) => ({ key, ...v })) };
}

export function monthlyReportDocument(txs: Transaction[], month: string, main: string, c: Ctx): string {
  const { t, lang } = c;
  const money = (v: number) => formatMoney(v, main);
  const s = monthlySummary(txs, month, main);
  const label = `${monthName(Number(month.slice(5, 7)), lang)} ${month.slice(0, 4)}`;
  const expenses = s.byCat.filter((x) => x.expense > 0).sort((a, b) => b.expense - a.expense);
  const incomes = s.byCat.filter((x) => x.income > 0).sort((a, b) => b.income - a.income);
  const blocks: ReportBlock[] = [
    {
      kind: 'pairs', heading: t('tools.report.summary'), strongLast: true,
      rows: [[t('tools.export.txCount'), String(s.count)], [t('tools.report.income'), money(s.income)], [t('tools.report.expense'), money(s.expense)], [t('tools.report.net'), money(s.income - s.expense)]],
    },
    { kind: 'table', heading: t('tools.export.expenseByCategory'), columns: [t('tools.report.category'), t('tools.report.amount')], numeric: [false, true], rows: expenses.map((x) => [categoryLabel(t, x.key), money(x.expense)]), empty: t('tools.export.none') },
    { kind: 'table', heading: t('tools.report.byCategory'), columns: [t('tools.report.category'), t('tools.report.amount')], numeric: [false, true], rows: incomes.map((x) => [categoryLabel(t, x.key), money(x.income)]), empty: t('tools.report.noIncome') },
  ];
  if (s.skipped > 0) blocks.push({ kind: 'pairs', rows: [[t('tools.report.skipped', { count: s.skipped }), '']] });
  return reportHtml({
    lang, owner: c.owner, title: t('tools.export.monthlyTitle'), subtitle: t('tools.export.monthlySubtitle', { month: label, currency: main }),
    blocks, footer: generated(c),
  });
}

export function historyDocument(txs: Transaction[], accounts: Account[], from: string, to: string, c: Ctx): string {
  const { t, lang } = c;
  const name = new Map(accounts.map((a) => [a.id, a.name]));
  const rows = txs
    .filter((x) => x.date >= from && x.date <= to)
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)))
    .map((x) => {
      const sign = x.type === 'income' ? '+' : x.type === 'expense' ? '−' : '';
      const who = x.type === 'transfer' ? `${name.get(x.accountId) ?? ''} → ${name.get(x.toAccountId ?? '') ?? ''}` : (name.get(x.accountId) ?? '');
      return [shortDate(x.date, lang), x.merchant || categoryLabel(t, x.categoryKey), categoryLabel(t, x.categoryKey), who, `${sign}${formatMoney(x.amount, x.currency)}`];
    });
  return reportHtml({
    lang, owner: c.owner, title: t('tools.export.historyTitle'), subtitle: t('tools.export.historySubtitle', { from: shortDate(from, lang), to: shortDate(to, lang), count: rows.length }),
    blocks: [{ kind: 'table', columns: [t('tools.export.colDate'), t('tools.export.colDesc'), t('tools.report.category'), t('tools.export.colAccount'), t('tools.report.amount')], numeric: [false, false, false, false, true], rows, empty: t('tools.export.none') }],
    footer: generated(c),
  });
}
