'use client'

import React, { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

/** Animated dots loader with reduced-motion support. */

const DOT_SIZES = {
  xs: 'h-1 w-1',
  sm: 'h-1.5 w-1.5',
  md: 'h-2.5 w-2.5',
  lg: 'h-3.5 w-3.5',
  xl: 'h-4 w-4',
}

const GAP_SIZES = {
  xs: 'gap-1',
  sm: 'gap-1.5',
  md: 'gap-2',
  lg: 'gap-2.5',
  xl: 'gap-3',
}

/**
 * DotsLoader Component
 *
 * @param {Object} props
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} [props.size='md'] Ukuran bulatan dots
 * @param {string} [props.color] Custom Tailwind background color class (default: 'bg-zinc-950 dark:bg-white')
 * @param {'gap-1'|'gap-1.5'|'gap-2'|'gap-2.5'|'gap-3'|string} [props.gap] Override jarak antar dots
 * @param {string} [props.className] Class untuk kontainer utama
 * @param {string} [props.dotClassName] Class tambahan untuk setiap bulatan
 * @param {React.ReactNode} [props.label] Label teks status opsional
 * @param {'bottom'|'right'} [props.labelPosition='bottom'] Posisi label relatif terhadap dots
 * @param {string} [props.ariaLabel] Accessible label untuk screen reader
 * @param {number} [props.count=3] Jumlah dot (default 3 dot)
 * @param {number} [props.duration=0.8] Durasi satu siklus animasi (detik)
 * @param {number} [props.stagger=0.18] Delay beruntun antar dot (detik)
 */
export function DotsLoader({
  size = 'md',
  color,
  gap,
  className,
  dotClassName,
  label,
  labelPosition = 'bottom',
  ariaLabel,
  count = 3,
  duration = 0.8,
  stagger = 0.18,
  ...props
}) {
  const reduceMotion = useReducedMotion()

  // Null-safe dot count generator
  const dotCount = Math.max(2, Math.min(Number(count) || 3, 6))
  const dots = useMemo(() => Array.from({ length: dotCount }, (_, i) => i), [dotCount])

  // Defensive class mapping
  const sizeClass = DOT_SIZES[size] || DOT_SIZES.md
  const gapClass = gap || GAP_SIZES[size] || GAP_SIZES.md
  const activeColor = color || 'bg-zinc-950 dark:bg-white'

  const accessibleText = typeof label === 'string' ? label : (ariaLabel || 'Memuat...')

  // Keyframes: vertical wave, elastic scale, and a specular opacity pulse.
  const dotAnimate = reduceMotion
    ? { opacity: [0.35, 1, 0.35] }
    : {
        y: ['0%', '-60%', '0%'],
        scale: [0.85, 1.25, 0.85],
        opacity: [0.35, 1, 0.35],
      }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={accessibleText}
      className={cn(
        'inline-flex items-center justify-center select-none',
        labelPosition === 'right' ? 'flex-row gap-3' : 'flex-col gap-2.5',
        className
      )}
      {...props}
    >
      {/* 3 Horizontal Dots Cluster */}
      <div className={cn('flex items-center justify-center', gapClass)}>
        {dots.map((dotIndex) => (
          <motion.span
            key={`dot-${dotIndex}`}
            initial={false}
            animate={dotAnimate}
            transition={{
              duration: Math.max(0.4, Number(duration) || 0.8),
              repeat: Infinity,
              ease: 'easeInOut',
              delay: dotIndex * (Number(stagger) || 0.18),
            }}
            className={cn(
              'rounded-full block shrink-0 transform-gpu will-change-transform',
              sizeClass,
              activeColor,
              dotClassName
            )}
          />
        ))}
      </div>

      {/* Screen reader fallback jika tidak ada teks tampak */}
      {!label && <span className="sr-only">{accessibleText}</span>}

      {/* Neo-Fintech Typography Label */}
      {label && (
        <span
          className={cn(
            'text-[10px] sm:text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400 select-none text-center',
            labelPosition === 'right' && 'text-left tracking-[0.12em]'
          )}
        >
          {label}
        </span>
      )}
    </div>
  )
}

/**
 * Fullscreen or overlay loading state.
 * Uses the app's modal z-index and a frosted backdrop.
 *
 * @param {boolean} [card=true] Show the elevated squircle card
 * @param {string} [label] Process title
 * @param {string} [description] Status detail
 * @param {string} [className] Extra backdrop classes
 */
export function DotsLoadingScreen({
  card = true,
  label = 'Memuat Data...',
  description,
  className,
  size = 'md',
  ...props
}) {
  return (
    <div
      role="alert"
      aria-busy="true"
      className={cn(
        'fixed inset-0 z-[70] flex items-center justify-center p-6',
        'bg-black/30 dark:bg-black/60 backdrop-blur-md saturate-150',
        'transition-all duration-300',
        className
      )}
      {...props}
    >
      {card ? (
        <div
          className={cn(
            'w-full max-w-[280px] rounded-2xl p-6 flex flex-col items-center justify-center text-center',
            'bg-white/[0.88] dark:bg-[#121214]/[0.92] backdrop-blur-2xl',
            'border border-black/[0.08] dark:border-white/[0.12]',
            'shadow-[0_20px_50px_rgba(0,0,0,0.15)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.6)]',
            'animate-in fade-in zoom-in-95 duration-200'
          )}
        >
          <div className="py-2">
            <DotsLoader size={size} />
          </div>

          {label && (
            <p className="mt-4 text-[13px] font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
              {label}
            </p>
          )}

          {description && (
            <p className="mt-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400 max-w-[220px]">
              {description}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-3">
          <DotsLoader size={size} label={label} />
          {description && (
            <p className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
              {description}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * DotsButtonLoader — Khusus disematkan di dalam Action Button
 * Otomatis mengambil warna teks (bg-current) dan ukuran rapat (sm/xs)
 */
export function DotsButtonLoader({ className, size = 'sm', ...props }) {
  return (
    <DotsLoader
      size={size}
      color="bg-current"
      gap="gap-1.5"
      className={cn('inline-flex', className)}
      {...props}
    />
  )
}

export default DotsLoader
