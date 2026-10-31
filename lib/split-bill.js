// lib/split-bill.js
// Logika murni untuk split bill by-items: line total tiap baris (price × qty −
// discount), baris diskon struk-level (is_discount, harga negatif), dan
// validasi total struk hasil OCR terhadap jumlah item.
//
// Dipakai TransactionDetailSheet (split per orang) dan ai.js (validasi OCR),
// plus test di tests/split-bill.test.mjs.

/**
 * Total satu baris item: harga satuan × qty − potongan baris.
 * Baris diskon struk-level (is_discount) sudah berharga negatif; qty-nya 1
 * sehingga hasilnya tetap jumlah potongan tersebut.
 */
export function lineTotal(item) {
  const price = Number(item?.price) || 0
  const qty = Number(item?.qty) || 1
  const discount = Number(item?.discount) || 0
  if (item?.is_discount) return price * qty
  return price * qty - discount
}

/** Jumlah semua baris (sudah termasuk baris diskon negatif). */
export function itemsSum(items) {
  return (items || []).reduce((sum, it) => sum + lineTotal(it), 0)
}

/**
 * Totals per peserta untuk mode split by-items.
 * - Baris biasa: line total dibagi rata ke assignees baris itu.
 * - Baris diskon struk-level (is_discount): dibagi rata ke SEMUA peserta,
 * karena potongan toko berlaku untuk seluruh struk, bukan per item.
 * Return { totals: {id: number}, unassigned: number }.
 */
export function computeSplitTotals(items, assign, people) {
  const totals = Object.fromEntries((people || []).map((p) => [p?.id, 0]))
  const allIds = (people || []).map((p) => p?.id).filter(Boolean)
  let unassigned = 0
  ;(items || []).forEach((it, idx) => {
    const total = lineTotal(it)
    const assignees = it?.is_discount
      ? allIds
      : (assign?.[idx] || [])
    if (!assignees.length) { unassigned += total; return }
    const share = total / assignees.length
    assignees.forEach((pid) => { if (totals[pid] != null) totals[pid] += share })
  })
  return { totals, unassigned }
}

/**
 * Validasi hasil OCR struk: jumlah item (setelah potongan baris, ditambah
 * baris diskon negatif) dikurang potongan struk-level plus pajak harus sama
 * dengan total struk. Toleransi: maksimum 1 satuan mata uang atau 0,5% total
 * (mana lebih besar) untuk mengakomodasi pembulatan struk.
 * Return { ok: boolean, expected: number, diff: number }.
 */
export function validateReceiptTotals({ items, discounts, tax, total }) {
  const sum = itemsSum(items)
  const discountSum = (discounts || []).reduce((s, d) => s + (Math.abs(Number(d?.amount)) || 0), 0)
  const taxNum = Number(tax) || 0
  const totalNum = Number(total) || 0
  // Baris diskon negatif sudah mengurangi sum; potongan struk-level yang belum
  // jadi baris item dikurangkan di sini.
  const expected = sum - discountSum + taxNum
  const diff = Math.abs(expected - totalNum)
  const tolerance = Math.max(1, Math.abs(totalNum) * 0.005)
  return { ok: diff <= tolerance, expected, diff }
}

/**
 * Samakan jumlah item dengan total struk (auto-reconcile).
 * Selisih = jumlah item - total: positif berarti item lebih besar dari yang
 * dibayar (kasus diskon struk) sehingga ditambah baris diskon berharga
 * NEGATIF; negatif berarti ada item terlewat dan hanya dilaporkan.
 * Return { items, matched, missing } - matched berarti jumlah item kini sama
 * dengan total (toleransi sama dengan validateReceiptTotals).
 */
export function reconcileItems(items, total) {
  const list = (items || []).map((it) => ({ ...it }))
  const totalNum = Number(total) || 0
  const sum = itemsSum(list)
  const diff = Math.round((sum - totalNum) * 1000) / 1000
  const tolerance = Math.max(1, Math.abs(totalNum) * 0.005)

  if (Math.abs(diff) <= tolerance) {
    return { items: list, matched: true, missing: false }
  }
  if (diff > 0) {
    // Item lebih besar dari total dibayar: potongan struk-level yang belum
    // terekstrak OCR, ditutup dengan baris diskon berharga negatif.
    list.push({ name: 'receipt_discount_auto', qty: 1, price: -diff, is_discount: true })
    return { items: list, matched: true, missing: false }
  }
  // Selisih negatif = ada item yang terlewat; biar user tambah manual.
  return { items: list, matched: false, missing: true }
}
