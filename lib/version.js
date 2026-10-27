import pkg from '@/package.json'

export const APP_VERSION = `v${pkg.version || '0.1.1'}`
export const GIT_COMMIT_SHA = (
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  process.env.NEXT_PUBLIC_COMMIT_HASH ||
  ''
).slice(0, 7)

export const BUILD_DATE =
  process.env.NEXT_PUBLIC_BUILD_DATE || new Date().toISOString().slice(0, 10)

// Label lengkap dinamis: "Arshif v0.1.1 (6f08cd4) · Finance app" atau "Arshif v0.1.1 · Finance app"
export const FULL_VERSION_LABEL = `Arshif ${APP_VERSION}${
  GIT_COMMIT_SHA ? ` (${GIT_COMMIT_SHA})` : ''
} · Finance app`
