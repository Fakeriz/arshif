/**
 * HTML untuk PDF (expo-print merender HTML -> PDF). Semua teks sudah diterjemahkan dan nominal sudah
 * diformat oleh pemanggil; modul ini hanya menyusun dokumen dan meng-escape isinya.
 * Tampilan cetak sengaja polos: tinta gelap di kertas putih, satu garis aksen di kepala dokumen.
 */

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const BASE_CSS = `
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif; color: #1c1915; font-size: 11pt; line-height: 1.45; margin: 0; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; padding-bottom: 14px; border-bottom: 2px solid var(--accent); }
  .doc-type { font-size: 20pt; font-weight: 800; letter-spacing: 0.5px; margin: 0; }
  .muted { color: #5c564e; }
  .small { font-size: 9pt; }
  .right { text-align: right; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  h2 { font-size: 11pt; margin: 22px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9pt; color: #5c564e; font-weight: 600; border-bottom: 1px solid #cfc8bd; padding: 6px 4px; }
  td { padding: 7px 4px; border-bottom: 1px solid #ebe6de; vertical-align: top; }
  .totals { margin-left: auto; width: 55%; margin-top: 12px; }
  .totals td { border: none; padding: 3px 4px; }
  .totals .grand td { border-top: 1.5px solid #1c1915; font-weight: 800; font-size: 12.5pt; padding-top: 8px; }
  .meta td { border: none; padding: 2px 0 2px 12px; }
  .block { margin-top: 18px; }
  .note { margin-top: 22px; padding: 10px 12px; background: #f4f1ea; border-radius: 6px; white-space: pre-wrap; }
  .disclaimer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #cfc8bd; font-size: 9pt; color: #5c564e; }
  .foot { margin-top: 26px; font-size: 8.5pt; color: #5c564e; }
`;

function page(title: string, accent: string, body: string, lang: string): string {
  return `<!doctype html><html lang="${esc(lang)}"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>:root { --accent: ${/^#[0-9a-fA-F]{6}$/.test(accent) ? accent : '#1c1915'}; }${BASE_CSS}</style></head><body>${body}</body></html>`;
}

export type InvoiceDoc = {
  lang: string;
  accent: string;
  /** "INVOICE" / "PENAWARAN". */
  docType: string;
  number: string;
  status?: string;
  sender: string;
  billTo: { label: string; name: string; contact?: string };
  meta: [string, string][];
  columns: { item: string; qty: string; price: string; amount: string };
  items: { name: string; qty: string; price: string; amount: string }[];
  totals: [string, string][];
  grand: [string, string];
  notes?: { label: string; text: string };
  footer: string;
};

export function invoiceHtml(d: InvoiceDoc): string {
  const rows = d.items
    .map((i) => `<tr><td>${esc(i.name)}</td><td class="num">${esc(i.qty)}</td><td class="num">${esc(i.price)}</td><td class="num">${esc(i.amount)}</td></tr>`)
    .join('');
  const body = `
  <div class="head">
    <div><p class="doc-type">${esc(d.docType)}</p><div class="muted">${esc(d.number)}${d.status ? ` · ${esc(d.status)}` : ''}</div></div>
    <div class="right"><strong>${esc(d.sender)}</strong></div>
  </div>
  <div class="head" style="border: none; padding-top: 14px;">
    <div><div class="muted small">${esc(d.billTo.label)}</div><strong>${esc(d.billTo.name)}</strong>${d.billTo.contact ? `<div>${esc(d.billTo.contact)}</div>` : ''}</div>
    <table class="meta" style="width: auto;">${d.meta.map(([k, v]) => `<tr><td class="muted">${esc(k)}</td><td class="num">${esc(v)}</td></tr>`).join('')}</table>
  </div>
  <table class="block">
    <thead><tr><th>${esc(d.columns.item)}</th><th class="num">${esc(d.columns.qty)}</th><th class="num">${esc(d.columns.price)}</th><th class="num">${esc(d.columns.amount)}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <table class="totals">
    ${d.totals.map(([k, v]) => `<tr><td class="muted">${esc(k)}</td><td class="num">${esc(v)}</td></tr>`).join('')}
    <tr class="grand"><td>${esc(d.grand[0])}</td><td class="num">${esc(d.grand[1])}</td></tr>
  </table>
  ${d.notes ? `<div class="note"><div class="muted small">${esc(d.notes.label)}</div>${esc(d.notes.text)}</div>` : ''}
  <div class="foot">${esc(d.footer)}</div>`;
  return page(`${d.docType} ${d.number}`, d.accent, body, d.lang);
}

/** Blok laporan: pasangan label-nilai, atau tabel dengan kolom. */
export type ReportBlock =
  | { kind: 'pairs'; heading?: string; rows: [string, string][]; strongLast?: boolean }
  | { kind: 'table'; heading?: string; columns: string[]; numeric: boolean[]; rows: string[][]; empty?: string };

export type ReportDoc = {
  lang: string;
  accent: string;
  title: string;
  subtitle: string;
  owner: string;
  blocks: ReportBlock[];
  disclaimer?: string;
  footer: string;
};

export function reportHtml(d: ReportDoc): string {
  const blocks = d.blocks
    .map((b) => {
      const h = b.heading ? `<h2>${esc(b.heading)}</h2>` : '';
      if (b.kind === 'pairs') {
        const rows = b.rows
          .map(([k, v], i) => {
            const strong = b.strongLast && i === b.rows.length - 1;
            return `<tr${strong ? ' style="font-weight:800"' : ''}><td>${esc(k)}</td><td class="num">${esc(v)}</td></tr>`;
          })
          .join('');
        return `${h}<table>${rows}</table>`;
      }
      const head = b.columns.map((c, i) => `<th${b.numeric[i] ? ' class="num"' : ''}>${esc(c)}</th>`).join('');
      const rows = b.rows.length
        ? b.rows.map((r) => `<tr>${r.map((c, i) => `<td${b.numeric[i] ? ' class="num"' : ''}>${esc(c)}</td>`).join('')}</tr>`).join('')
        : `<tr><td colspan="${b.columns.length}" class="muted">${esc(b.empty ?? '')}</td></tr>`;
      return `${h}<table><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>`;
    })
    .join('');
  const body = `
  <div class="head">
    <div><p class="doc-type">${esc(d.title)}</p><div class="muted">${esc(d.subtitle)}</div></div>
    <div class="right"><strong>${esc(d.owner)}</strong></div>
  </div>
  ${blocks}
  ${d.disclaimer ? `<div class="disclaimer">${esc(d.disclaimer)}</div>` : ''}
  <div class="foot">${esc(d.footer)}</div>`;
  return page(d.title, d.accent, body, d.lang);
}
