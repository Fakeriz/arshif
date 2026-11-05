import { minorToMajor, xenditPaymentMethods } from './billing.ts';
import { XENDIT_SECRET_KEY } from './env.ts';
import { HttpError } from './http.ts';
import { exponentOf } from './money.ts';

export type XenditInvoice = { id: string; invoice_url: string; expiry_date: string };

/** Xendit Invoice API v2: satu halaman bayar berisi VA, QRIS, e-wallet (IDR) atau FPX, e-wallet (MYR). */
export async function createInvoice(input: {
  orderId: string;
  amount: number;
  currency: string;
  method: string;
  email: string | null;
  description: string;
  returnUrl: string;
}): Promise<XenditInvoice> {
  const methods = xenditPaymentMethods(input.currency, input.method);
  const res = await fetch('https://api.xendit.co/v2/invoices', {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${XENDIT_SECRET_KEY()}:`)}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      external_id: input.orderId,
      amount: minorToMajor(input.amount, exponentOf(input.currency)),
      currency: input.currency,
      description: input.description,
      invoice_duration: 86_400,
      success_redirect_url: input.returnUrl,
      failure_redirect_url: input.returnUrl,
      ...(input.email ? { payer_email: input.email } : {}),
      ...(methods ? { payment_methods: methods } : {}),
    }),
  });
  if (!res.ok) throw new HttpError('provider_error', 502, { message: `xendit_${res.status}` });
  return (await res.json()) as XenditInvoice;
}
