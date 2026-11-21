import { z } from 'zod';

/** PRD FR-AUTH-1: kata sandi baru minimal 8 karakter, huruf + angka. Saat masuk, server yang menilai. */
export const NewPassword = z.string().min(8).max(72).regex(/[A-Za-z]/).regex(/\d/);
