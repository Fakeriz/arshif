/**
 * Deklarasi minimal API Deno yang dipakai Edge Functions, hanya untuk `npm run typecheck:functions`
 * di mesin tanpa Deno. Runtime sungguhan (Supabase Edge Runtime) menyediakan API lengkap.
 */
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): unknown;
  namespace env {
    function get(name: string): string | undefined;
  }
}
