import { GEMINI_API_KEY, GEMINI_MODELS } from './env.ts';

/** Gemini hanya dipanggil dari Edge Functions (PRD Bab 10). */
const endpoint = (model: string) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
/** Per percobaan. Dua percobaan tetap jauh di bawah batas waktu Edge Function. */
const TIMEOUT_MS = 15_000;
/** Model penuh (503/429), tidak tersedia (404), menggantung (timeout), atau gangguan jaringan: coba model cadangan. */
const RETRYABLE = (e: unknown) => e instanceof AiError && /^(http_(404|429|500|503)|timeout|network)$/.test(e.message);

export type InlineData = { mimeType: string; base64: string };

/** Skema keluaran (subset OpenAPI yang diterima Gemini). */
export type GeminiSchema = Record<string, unknown>;

export class AiError extends Error {}

/**
 * Minta JSON terstruktur. `thinkingBudget: 0` = jawaban cepat (target OCR < 6 detik, voice < 4 detik).
 * Melempar AiError bila HTTP gagal, waktu habis, diblokir, atau keluaran bukan JSON.
 */
export async function generateJson(prompt: string, schema: GeminiSchema, inline?: InlineData): Promise<unknown> {
  const parts: Record<string, unknown>[] = [{ text: prompt }];
  if (inline) parts.push({ inline_data: { mime_type: inline.mimeType, data: inline.base64 } });
  // Utama → cadangan → utama lagi (setelah jeda): beban Gemini sering melonjak sesaat.
  const [primary, ...rest] = GEMINI_MODELS();
  const models = [primary, ...rest, primary];
  for (let i = 0; i < models.length; i++) {
    try {
      if (i === models.length - 1 && i > 0) await new Promise((r) => setTimeout(r, 1200));
      return await callModel(models[i], parts, schema);
    } catch (e) {
      if (i === models.length - 1 || !RETRYABLE(e)) throw e;
    }
  }
  throw new AiError('no_model');
}

async function callModel(model: string, parts: Record<string, unknown>[], schema: GeminiSchema): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(endpoint(model), {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY() },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: 'application/json',
          responseSchema: schema,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });
  } catch (e) {
    throw new AiError(e instanceof Error && e.name === 'AbortError' ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new AiError(`http_${res.status}`);

  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) throw new AiError(`empty_${body.candidates?.[0]?.finishReason ?? 'none'}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new AiError('not_json');
  }
}
