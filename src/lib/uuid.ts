import { randomUUID } from 'expo-crypto';

/** UUID v4 untuk baris baru yang dibuat klien (transaksi, item), sehingga simpan ulang idempoten. */
export const newId = (): string => randomUUID();
