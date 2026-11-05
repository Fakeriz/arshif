// Muat modul TS aplikasi (src/) langsung di Node 22 (type stripping): alias "@/" dan impor tanpa ekstensi.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');

export async function resolve(spec, ctx, next) {
  let p = null;
  if (spec.startsWith('@/')) p = path.join(SRC, spec.slice(2));
  else if ((spec.startsWith('./') || spec.startsWith('../')) && ctx.parentURL?.endsWith('.ts')) p = path.resolve(path.dirname(fileURLToPath(ctx.parentURL)), spec);
  if (p) {
    for (const c of [p, `${p}.ts`, `${p}.tsx`, `${p}/index.ts`]) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return { url: pathToFileURL(c).href, shortCircuit: true };
    }
  }
  return next(spec, ctx);
}

export async function load(url, ctx, next) {
  if (url.endsWith('.ts')) return next(url, { ...ctx, format: 'module-typescript' });
  return next(url, ctx);
}
