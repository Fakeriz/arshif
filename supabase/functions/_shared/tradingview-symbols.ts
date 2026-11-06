/**
 * Kunci harga netral -> simbol TradingView, dan pemeriksaan hasilnya. Tanpa import supaya bisa diuji di Jest.
 * Simbol diverifikasi 2026-11-06: IDX:BBCA (IDR, tertunda 10 menit), AAPL -> NASDAQ:AAPL, BINANCE:BTCUSDT (USDT),
 * OANDA:XAUUSD dan TVC:GOLD (USD per troy ounce).
 */

/** Kandidat simbol berurutan; kandidat berikutnya dicoba bila yang pertama gagal. */
export function tvCandidates(key: string): string[] {
  const [market, code] = key.split(':');
  switch (market) {
    case 'IDX':
      return [`IDX:${code}`];
    // Ticker tanpa bursa: TradingView memilih bursa utama AS (AAPL -> NASDAQ:AAPL, KO -> NYSE:KO).
    case 'US':
      return [code];
    case 'CRYPTO':
      return [`BINANCE:${code}USDT`];
    case 'GOLD':
      return code === 'XAU' ? ['OANDA:XAUUSD', 'TVC:GOLD'] : [];
    default:
      return [];
  }
}

const US_EXCHANGES = new Set(['NASDAQ', 'NYSE', 'AMEX', 'BATS', 'ARCA', 'CBOE']);

/** Tolak hasil yang tidak cocok dengan pasar yang diminta (mis. ticker US yang ternyata bursa lain). */
export function quoteMatches(key: string, proName: string | undefined, currency: string | undefined): boolean {
  const market = key.split(':')[0];
  const exchange = (proName ?? '').split(':')[0];
  if (market === 'IDX') return exchange === 'IDX' && currency === 'IDR';
  if (market === 'US') return US_EXCHANGES.has(exchange) && currency === 'USD';
  if (market === 'CRYPTO') return currency === 'USDT';
  if (market === 'GOLD') return currency === 'USD';
  return false;
}
