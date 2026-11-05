import { PADDLE_CLIENT_TOKEN, PADDLE_ENV } from '@/config/public';

type PaddleGlobal = {
  Environment: { set: (env: 'sandbox' | 'production') => void };
  Initialize: (opts: { token: string }) => void;
  Checkout: { open: (opts: { transactionId: string; settings?: { successUrl?: string; displayMode?: 'overlay' } }) => void };
};

const SRC = 'https://cdn.paddle.com/paddle/v2/paddle.js';
let ready: Promise<PaddleGlobal> | null = null;

function load(): Promise<PaddleGlobal> {
  ready ??= new Promise((resolve, reject) => {
    const done = () => {
      const p = (window as unknown as { Paddle?: PaddleGlobal }).Paddle;
      if (!p) return reject(new Error('paddle_missing'));
      if (PADDLE_ENV === 'sandbox') p.Environment.set('sandbox');
      p.Initialize({ token: PADDLE_CLIENT_TOKEN });
      resolve(p);
    };
    const script = document.createElement('script');
    script.src = SRC;
    script.async = true;
    script.onload = done;
    script.onerror = () => {
      ready = null;
      reject(new Error('paddle_load_failed'));
    };
    document.head.appendChild(script);
  });
  return ready;
}

/** Overlay checkout Paddle untuk transaksi yang dibuat server (checkout-create). */
export async function openPaddleCheckout(transactionId: string, successUrl: string): Promise<void> {
  if (!PADDLE_CLIENT_TOKEN) throw new Error('paddle_not_configured');
  const paddle = await load();
  paddle.Checkout.open({ transactionId, settings: { successUrl, displayMode: 'overlay' } });
}
