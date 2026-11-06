// Tipe minimal untuk typecheck (tsc -p supabase/functions). Deno memakai tipe asli paket npm-nya.
declare module '@mathieuc/tradingview' {
  export class TradingViewClient {
    constructor(options?: Record<string, unknown>);
    close(): Promise<void>;
  }
  export type Quote = { lp?: number; pro_name?: string; currency_code?: string; lp_time?: number; update_mode?: string };
  export function getQuote(query: { symbol: string; client?: TradingViewClient; timeoutMs?: number }): Promise<Quote>;
}
