import { GEMINI_API_KEY } from './env.ts';

/** Gemini hanya dipanggil dari Edge Functions (PRD Bab 10). */
const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const TIMEOUT_MS = 25_000;

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
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
