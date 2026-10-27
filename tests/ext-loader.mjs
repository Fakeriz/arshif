// Node ESM loader: resolves extensionless relative imports inside the
// project (e.g. `./rates` -> `./rates.js`) so plain `node --test` can
// exercise the production modules directly.
const EXTS = ['', '.js', '.jsx', '.mjs', '.cjs']

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !EXTS.includes(specifier) && !/\.[a-z]+$/i.test(specifier)) {
    for (const ext of ['.js', '.jsx', '.mjs', '.cjs']) {
      try {
        const resolved = await nextResolve(specifier + ext, context)
        return { ...resolved, shortCircuit: true }
      } catch (err) {
        if (err.code !== 'ERR_MODULE_NOT_FOUND' && err.code !== 'MODULE_NOT_FOUND') throw err
      }
    }
  }
  return nextResolve(specifier, context)
}
