/** Native tidak memakai Paddle (web checkout saja). */
export async function openPaddleCheckout(_transactionId: string, _successUrl: string): Promise<void> {
  throw new Error('paddle_web_only');
}
