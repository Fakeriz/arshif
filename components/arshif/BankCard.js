'use client'

import { useMemo } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { getTheme, ACCOUNT_TYPES } from '@/lib/categories'
import { getCurrency } from '@/lib/currencies'
import { LogoBadge } from './ui'
import { cn } from '@/lib/utils'
import { DECK_EDGE_ACCENT, FOCAL_INK } from '@/lib/accountDeck'

// Deterministic last-4 digits
export function digits4(s) {
  let h = 0
  const str = String(s || 'arshif')
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return String(h % 10000).padStart(4, '0')
}

// Gold EMV Chip standar kartu fisik (Single component, proporsional)
export function EmvChip({ className = '', isLight = false }) {
  return (
    <div
      className={cn(
        'w-8 h-6 rounded-md relative overflow-hidden shrink-0 select-none shadow-xs',
        'bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 border border-amber-500/80', /* Amber gradien purposeful: meniru warna emas/kuning kartu debit fisik — identity motif produk (R-01) */
        className
      )}
    >
      <div className="absolute inset-0 border border-amber-700/40 rounded-[3px] m-[2px]">
        <div className="absolute inset-x-2 inset-y-1.5 border border-amber-800/40 rounded-[2px] bg-amber-400/30" />
        <div className="absolute top-1/2 inset-x-0 h-px bg-amber-800/30 -translate-y-1/2" />
        <div className="absolute inset-y-0 left-2 w-px bg-amber-800/30" />
        <div className="absolute inset-y-0 right-2 w-px bg-amber-800/30" />
      </div>
    </div>
  )
}

// Contactless / NFC Wave Icon
export function ContactlessWave({ className = '' }) {
  return (
    <svg
      className={cn('w-4 h-4 shrink-0', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
    >
      <path d="M6.5 9a6 6 0 0 1 0 6" opacity="0.65" />
      <path d="M10.5 6a10 10 0 0 1 0 12" opacity="0.85" />
      <path d="M14.5 3a14 14 0 0 1 0 18" />
    </svg>
  )
}

// Network Logo (VISA or Mastercard)
export function NetworkBadge({ network = 'visa', isLight = false, className = '' }) {
  if (network === 'mastercard') {
    return (
      <div className={cn('flex items-center -space-x-2 shrink-0', className)} title="Mastercard">
        <div className="w-5 h-5 rounded-full bg-[#EB001B] shadow-sm" />
        <div className="w-5 h-5 rounded-full bg-[#F79E1B] mix-blend-screen opacity-95 shadow-sm" />
      </div>
    )
  }

  return (
    <span
      className={cn(
        'font-black italic tracking-tighter text-sm shrink-0 font-sans select-none',
        isLight ? 'text-[#09090B]' : 'text-white/95 drop-shadow-sm',
        className
      )}
    >
      VISA
    </span>
  )
}

// SVG Backgrounds for the 6 Physical Motifs
export function CardMotifTexture({ motif = 'parang', isLight = false }) {
  if (motif === 'obsidian') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-[#0C0C0E]">
        <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full bg-white/[0.04] blur-2xl pointer-events-none" />
        <div className="absolute right-0 bottom-0 w-36 h-36 rounded-full bg-white/[0.02] blur-xl pointer-events-none" />
      </div>
    )
  }

  if (motif === 'glacier') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-[#FFFFFF]">
        <svg className="absolute inset-0 w-full h-full opacity-15" viewBox="0 0 320 200" fill="none" preserveAspectRatio="none">
          <path d="M -10 30 Q 80 40 130 90 T 260 110 T 340 180" stroke="#09090B" strokeWidth="1.2" fill="none" />
          <path d="M 40 -10 Q 90 70 170 80 T 290 140" stroke="#09090B" strokeWidth="1" fill="none" />
          <path d="M 130 90 L 170 140 M 170 80 L 150 40" stroke="#09090B" strokeWidth="0.8" fill="none" />
          <path d="M 210 -10 Q 240 60 300 80" stroke="#09090B" strokeWidth="1" fill="none" />
        </svg>
      </div>
    )
  }

  if (motif === 'spider') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-gradient-to-br from-[#7F1D1D] to-[#09090B]">
        <svg className="absolute -top-12 -right-12 w-64 h-64 opacity-15" viewBox="0 0 200 200" fill="none">
          <line x1="200" y1="0" x2="0" y2="20" stroke="#ffffff" strokeWidth="1" />
          <line x1="200" y1="0" x2="0" y2="70" stroke="#ffffff" strokeWidth="1" />
          <line x1="200" y1="0" x2="0" y2="130" stroke="#ffffff" strokeWidth="1" />
          <line x1="200" y1="0" x2="0" y2="200" stroke="#ffffff" strokeWidth="1" />
          <line x1="200" y1="0" x2="60" y2="200" stroke="#ffffff" strokeWidth="1" />
          <line x1="200" y1="0" x2="120" y2="200" stroke="#ffffff" strokeWidth="1" />
          <line x1="200" y1="0" x2="170" y2="200" stroke="#ffffff" strokeWidth="1" />
          <path d="M 170 0 L 150 15 L 140 35 L 145 60 L 165 75 L 190 70 Z" stroke="#ffffff" strokeWidth="0.9" fill="none" />
          <path d="M 140 0 L 110 25 L 95 65 L 105 105 L 140 135 L 180 130 Z" stroke="#ffffff" strokeWidth="0.9" fill="none" />
          <path d="M 100 0 L 60 40 L 40 95 L 60 155 L 110 195 L 160 190 Z" stroke="#ffffff" strokeWidth="0.9" fill="none" />
          <path d="M 60 0 L 10 55 L -10 130 L 15 200" stroke="#ffffff" strokeWidth="0.8" fill="none" />
        </svg>
      </div>
    )
  }

  if (motif === 'kawung') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-[#0C0C0E]">
        <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="batik-kawung" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="0" r="14" fill="none" stroke="#ffffff" strokeWidth="1" />
              <circle cx="20" cy="40" r="14" fill="none" stroke="#ffffff" strokeWidth="1" />
              <circle cx="0" cy="20" r="14" fill="none" stroke="#ffffff" strokeWidth="1" />
              <circle cx="40" cy="20" r="14" fill="none" stroke="#ffffff" strokeWidth="1" />
              <rect x="18" y="18" width="4" height="4" transform="rotate(45 20 20)" fill="#ffffff" />
              <circle cx="20" cy="8" r="1.5" fill="#ffffff" />
              <circle cx="20" cy="32" r="1.5" fill="#ffffff" />
              <circle cx="8" cy="20" r="1.5" fill="#ffffff" />
              <circle cx="32" cy="20" r="1.5" fill="#ffffff" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#batik-kawung)" />
        </svg>
      </div>
    )
  }

  if (motif === 'matrix') {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-[#0A0F1D]">
        <svg className="absolute inset-0 w-full h-full opacity-20" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="cyber-hex" width="30" height="51.96" patternUnits="userSpaceOnUse">
              <path d="M 15 0 L 30 8.66 L 30 25.98 L 15 34.64 L 0 25.98 L 0 8.66 Z" fill="none" stroke="#14b8a6" strokeWidth="1" />
              <path d="M 15 34.64 L 30 43.3 L 30 60.62 L 15 69.28 L 0 60.62 L 0 43.3 Z" fill="none" stroke="#0d9488" strokeWidth="1" />
              <circle cx="15" cy="0" r="1.5" fill="#14b8a6" />
              <circle cx="15" cy="34.64" r="1.5" fill="#2dd4bf" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cyber-hex)" />
        </svg>
      </div>
    )
  }

  // Batik Parang (Default)
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden bg-[#121216]">
      <svg className="absolute -inset-4 w-[120%] h-[120%] opacity-20" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="batik-parang" width="60" height="60" patternTransform="rotate(-40 0 0)" patternUnits="userSpaceOnUse">
            <path d="M 10 0 C 15 15, 30 15, 35 30 C 40 45, 55 45, 60 60" fill="none" stroke="#eab308" strokeWidth="1.5" />
            <path d="M 0 20 C 5 35, 20 35, 25 50" fill="none" stroke="#ca8a04" strokeWidth="1.2" />
            <path d="M 20 0 C 25 15, 40 15, 45 30" fill="none" stroke="#d4af37" strokeWidth="1.2" />
            <circle cx="15" cy="18" r="2.5" fill="#facc15" />
            <circle cx="35" cy="38" r="2.5" fill="#facc15" />
            <path d="M 10 10 Q 18 14 14 22 Q 10 18 10 10 Z" fill="#d4af37" />
            <path d="M 30 30 Q 38 34 34 42 Q 30 38 30 30 Z" fill="#d4af37" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#batik-parang)" />
      </svg>
    </div>
  )
}

// The coral gradient is reserved for the active (focal) deck card; non-focal
// cards use a flat raised surface so a second gradient never competes with it.
// Amounts and surface hexes come from the single token module.
/**
 * Visibility control shared by the focal cards. The visual icon stays small,
 * but the hit area is a full 44x44px so the target meets the touch minimum.
 */
export function CardVisibilityToggle({ hidden = false, onToggle = null, ink = 'dark', label, className = '' }) {
  if (!onToggle) return null
  const Icon = hidden ? EyeOff : Eye
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label || (hidden ? 'Show balance' : 'Hide balance')}
      aria-pressed={hidden}
      data-testid="balance-visibility-toggle"
      className={cn(
        'relative z-10 -m-3 h-11 w-11 shrink-0 rounded-full border-0 bg-transparent p-0 flex items-center justify-center transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2',
        ink === 'dark'
          ? 'text-[#090A0D]/60 hover:text-[#090A0D] focus-visible:ring-[#090A0D]/60'
          : 'text-white/70 hover:text-white focus-visible:ring-white/60',
        className
      )}
    >
      <Icon size={15} strokeWidth={1.9} />
    </button>
  )
}

export const FOCAL_GRADIENT_CLASS = 'bg-gradient-to-br from-[#FF5F6D] to-[#FF9966]'

/**
 * Stacked card behind the focal card. Deliberately carries no content: only the
 * top edge of a back card is visible, and the handoff forbids showing partial
 * unreadable text in the peek.
 */
export function CardEdgeSurface({ accent = DECK_EDGE_ACCENT, label = 'Next account', className = '' }) {
  return (
    <div
      className={cn(
        'relative h-full w-full overflow-hidden rounded-[19px] border border-white/[0.08] bg-[#12151B] shadow-[0_14px_30px_rgba(0,0,0,0.28)]',
        className
      )}
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-[#191D25]/70" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <span className="absolute left-4 top-4 h-1 w-9 rounded-full" style={{ background: accent }} />
      <span className="absolute left-4 top-8 max-w-[calc(100%-32px)] truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60">
        {label}
      </span>
    </div>
  )
}

/**
 * Focal deck card: the only surface allowed to carry the coral gradient.
 * Composition follows the handoff order, label and balance first, identity and
 * status below. Ink is near-black because white on #FF5F6D is 2.95:1.
 */
export function FocalAccountCard({
  name,
  balance,
  currency = 'USD',
  theme = 'parang',
  logo = null,
  type = 'bank',
  id = null,
  fmt = null,
  hideBalance = false,
  onToggleVisibility = null,
  rightHeader = null,
  approxHome = null,
  className = '',
}) {
  const th = getTheme(theme)
  const cur = getCurrency(currency)
  const typeLabel = ACCOUNT_TYPES.find((x) => x.id === type)?.label || 'Account'
  const masked = hideBalance ? '••••••' : fmt ? fmt(balance ?? 0, currency) : `${cur.symbol} ${Number(balance || 0).toLocaleString()}`
  const approx = approxHome && !hideBalance ? (String(approxHome).startsWith('≈') ? approxHome : `≈ ${approxHome}`) : null

  return (
    <div
      className={cn(
        'w-full aspect-[1.58/1] min-h-[185px] rounded-[19px] p-5 relative overflow-hidden flex flex-col justify-between shrink-0 select-none',
        FOCAL_GRADIENT_CLASS,
        // Hairline ring only: the handoff forbids a heavy glow on the focal card.
        'ring-1 ring-inset ring-black/10 shadow-[0_18px_40px_-18px_rgba(255,95,109,0.45)]',
        className
      )}
      style={{ color: FOCAL_INK }}
      data-testid="focal-account-card"
    >
      {/* Sheen: one soft diagonal wash, kept under 8% opacity so it never lifts
          the ink contrast at the corners where the gradient is lightest. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.07] to-white/[0.14]" />

      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] truncate leading-tight text-[#090A0D]/85">
            {name || '—'}
          </p>
          <span className="text-[9px] font-bold uppercase tracking-[0.26em] text-[#090A0D]/60">
            {typeLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rightHeader}
          {logo ? (
            <LogoBadge logoId={logo} />
          ) : (
            <div
              className="h-9 w-9 rounded-2xl flex items-center justify-center border border-black/10 bg-black/[0.08] text-[#090A0D] font-extrabold text-[12px] tracking-tight"
              title={name || 'Account'}
            >
              {String(name || '••')
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div className="relative z-10 my-auto">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[9px] font-bold uppercase tracking-[0.26em] text-[#090A0D]/60">Saldo</p>
          <CardVisibilityToggle hidden={hideBalance} onToggle={onToggleVisibility} />
        </div>
        <p
          className="text-[30px] sm:text-[34px] leading-none font-extrabold tabular-nums tracking-tight truncate mt-1 text-[#090A0D]"
          title={typeof balance === 'number' ? String(balance) : ''}
        >
          {masked}
        </p>
        {approx ? (
          <p className="text-[11px] font-medium mt-1 truncate text-[#090A0D]/70">{approx}</p>
        ) : null}
      </div>

      <div className="relative z-10 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.18em] tabular-nums text-[#090A0D]/75">
            {hideBalance ? '•••• •••• •••• ••••' : `•••• •••• •••• ${digits4(id || name || 'arshif')}`}
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-[0.22em] mt-1 text-[#090A0D]/55">
            {typeLabel} · {th.name}
          </p>
        </div>
        <NetworkBadge network={th.network || 'visa'} isLight />
      </div>
    </div>
  )
}

/**
 * Standard Bank Physical Card Component
 */
export function BankCard({
  name,
  balance,
  currency = 'USD',
  theme = 'parang',
  logo = null,
  icon = 'card',
  type = 'bank',
  id = null,
  fmt = null,
  className = '',
  hideBalance = false,
  showNetwork = true,
  rightHeader = null,
  approxHome = null,
  isCollapsed = false,
  showOcclusionShadow = true,
  flat = false,
  onClick = null,
  style = {},
}) {
  const th = getTheme(theme)
  const cur = getCurrency(currency)
  const typeLabel = ACCOUNT_TYPES.find((x) => x.id === type)?.label || 'Account'
  const isCardLight = Boolean(th.isLight || th.id === 'glacier' || theme === 'glacier' || theme === 'white')
  const motif = th.motif || theme || 'parang'

  const titleCls = isCardLight ? 'text-[#09090B]' : 'text-white'
  const subCls = isCardLight ? 'text-zinc-600' : 'text-zinc-300'

  const formattedBalance = useMemo(() => {
    if (hideBalance) return '••••••'
    if (fmt) return fmt(balance ?? 0, currency)
    return `${cur.symbol} ${Number(balance || 0).toLocaleString()}`
  }, [balance, currency, fmt, hideBalance, cur.symbol])

  const balanceParts = useMemo(() => {
    if (hideBalance) return null

    const raw = fmt ? String(fmt(balance ?? 0, currency)) : `${cur.symbol} ${Number(balance || 0).toLocaleString()}`
    const match = raw.match(/^(-?)([^\d\s]+)\s*(.+)$/)
    if (match) {
      return {
        prefixSign: match[1] || '',
        symbol: match[2] || cur.symbol,
        digits: match[3] || '',
      }
    }

    return {
      prefixSign: Number(balance || 0) < 0 ? '-' : '',
      symbol: cur.symbol || currency,
      digits: Number(Math.abs(balance || 0)).toLocaleString(),
    }
  }, [balance, currency, fmt, hideBalance, cur.symbol])

  const monogram = useMemo(() => {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean)
    if (words.length > 1) return `${words[0][0]}${words[1][0]}`.toUpperCase()
    return (words[0] || '\u2022\u2022').slice(0, 2).toUpperCase()
  }, [name])

  const occlusionShadowCls = !flat && showOcclusionShadow
    ? 'shadow-[0_1px_2px_rgba(16,16,20,0.06),0_14px_30px_-10px_rgba(16,16,20,0.22)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_14px_30px_-10px_rgba(0,0,0,0.5)]'
    : 'shadow-none'

  const topBorderCls = isCardLight
    ? 'border-t border-t-zinc-300 border-zinc-200'
    : 'border-t border-t-white/20 border-white/10'

  return (
    <div
      onClick={onClick}
      style={style}
      className={cn(
        'w-full aspect-[1.58/1] min-h-[185px] rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between shrink-0 select-none bg-[#0c0c0e]',
        th.className,
        topBorderCls,
        occlusionShadowCls,
        className
      )}
    >
      {/* 1) Motif Background Texture */}
      <CardMotifTexture motif={motif} isLight={isCardLight} />

      {/* 2) Mode Tampilan: Collapsed vs Expanded */}
      {isCollapsed ? (
        /* Collapsed Mode (~55px header strip) */
        <div className="flex items-start justify-between gap-3 relative z-10 w-full">
          <div className="flex flex-col items-start min-w-0">
            <p className={cn('text-xs sm:text-sm font-bold uppercase tracking-[0.2em] truncate leading-tight', titleCls)}>
              {name || '—'}
            </p>
            <span className={cn('text-[9px] font-bold uppercase tracking-[0.26em] mt-0 opacity-80', subCls)}>
              {typeLabel || 'BANK'}
            </span>
          </div>

          <div className="shrink-0">
            {logo ? (
              <LogoBadge logoId={logo} />
            ) : (
              <div
                className={cn(
                  'h-9 w-9 rounded-2xl flex items-center justify-center border shrink-0 font-extrabold text-[12px] tracking-tight shadow-sm',
                  isCardLight
                    ? 'bg-zinc-950/5 border-zinc-300 text-zinc-900'
                    : 'bg-white/10 border-white/20 text-white'
                )}
                title={name || 'Account'}
              >
                {monogram}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Full Expanded Mode */
        <>
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3 relative z-10 w-full">
            <div className="flex flex-col items-start min-w-0">
              <p className={cn('text-xs sm:text-sm font-bold uppercase tracking-[0.2em] truncate leading-tight', titleCls)}>
                {name || '—'}
              </p>
              <span className={cn('text-[9px] font-bold uppercase tracking-[0.26em] mt-0 opacity-80', subCls)}>
                {typeLabel || 'BANK'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {rightHeader}
              {logo ? (
                <LogoBadge logoId={logo} />
              ) : (
                <div
                  className={cn(
                    'h-9 w-9 rounded-2xl flex items-center justify-center border shrink-0 font-extrabold text-[12px] tracking-tight shadow-sm',
                    isCardLight
                      ? 'bg-zinc-950/5 border-zinc-300 text-zinc-900'
                      : 'bg-white/10 border-white/20 text-white'
                  )}
                  title={name || 'Account'}
                >
                  {monogram}
                </div>
              )}
            </div>
          </div>

          {/* Chip & Contactless Icons */}
          <div className="flex items-center gap-3 relative z-10 my-auto">
            <EmvChip isLight={isCardLight} />
            <ContactlessWave className={isCardLight ? 'text-zinc-600' : 'text-white/70'} />
          </div>

          {/* Balance & Network Row */}
          <div className="flex items-end justify-between gap-3 relative z-10 mt-auto">
            <div className="min-w-0">
              <p
                className={cn(
                  'text-2xl sm:text-[30px] leading-none font-bold tabular-nums tracking-tight truncate opacity-95 flex items-baseline gap-1.5',
                  titleCls
                )}
                title={typeof balance === 'number' ? String(balance) : ''}
              >
                {balanceParts ? (
                  <>
                    {balanceParts.prefixSign && (
                      <span className="text-xl font-bold opacity-80">{balanceParts.prefixSign}</span>
                    )}
                    <span className="text-base sm:text-lg font-bold tracking-tight opacity-75 select-none">
                      {balanceParts.symbol}
                    </span>
                    <span className="font-extrabold tracking-tight">
                      {balanceParts.digits}
                    </span>
                  </>
                ) : (
                  formattedBalance
                )}
              </p>

              {approxHome ? (
                <p className={cn('text-[11px] font-normal mt-1 truncate opacity-70', subCls)}>
                  {hideBalance ? '••••••' : String(approxHome).startsWith('≈') ? approxHome : `≈ ${approxHome}`}
                </p>
              ) : null}
            </div>

            {showNetwork && (
              <NetworkBadge network={th.network || 'visa'} isLight={isCardLight} />
            )}
          </div>
        </>
      )}
    </div>
  )
}