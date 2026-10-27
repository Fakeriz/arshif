'use client'

import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { motion, useReducedMotion, useMotionValue, useTransform, animate } from 'framer-motion'
import { cn } from '@/lib/utils'

/**
 * AccountDeck — Carousel tumpukan kartu bank ultra-smooth (Framer Motion).
 *
 * Mengapa versi sebelumnya glitch/patah di HP:
 *  1. Kartu peek dipisah di <div> statis dengan CSS transition, sedangkan
 *     kartu aktif di dalam AnimatePresence. Saat index berganti, kartu
 *     di-unmount dari PeekCard dan di-mount ulang di AnimatePresence,
 *     menyebabkan elemen berkedip/hilang sesaat dan melompat dari x=+48px.
 *  2. mode="popLayout" pada AnimatePresence menyebabkan kalkulasi absolut
 *     berbenturan dengan container aspect-ratio pada mobile.
 *
 * Solusi Arsitektur (Unified Continuous Stack):
 *  - Semua kartu di-render dalam satu layer Framer Motion persisten (key tetap).
 *  - Posisi fisik (x, y, scale, opacity, brightness, zIndex) dihitung secara
 *    matematis dari selisih `diff = i - activeIdx`.
 *  - Saat berganti kartu, kartu aktif meluncur mulus ke kiri (x: -108%),
 *    kartu di belakangnya (diff: 1) membesar dari scale 0.94 -> 1.0 dan y: -14px -> 0
 *    tanpa ada unmount/remount sama sekali!
 *  - Transisi spring critically damped (stiffness 300, damping 30) bebas getar,
 *    buttery smooth, dan nyaman dilihat.
 */

const SWIPE_OFFSET = 45 // px minimum drag untuk memicu ganti kartu
const SWIPE_VELOCITY = 220 // px/s kecepatan flick untuk ganti kartu

// Ekspresi 3D ala referensi (Dribbble 3D card swipe):
// - kartu aktif miring (rotate) mengikuti jarak drag, rileks saat lepas
// - kartu belakang "membuka" (fan-out): naik + membesar seiring drag
const DRAG_FULL = 140 // px drag untuk ekspresi 3D penuh
const TILT_FACTOR = 0.06 // derajat tilt per px drag
const TILT_MAX = 7 // clamp tilt maksimum
const LIFT_SCALE = 0.03 // kartu aktif membesar 3% saat diangkat — menutup celah kartu belakang + efek "terangkat ke viewer"
const FAN_PER_DIFF = 4 // fan-out per tingkat (kecil agar muat di ruang atas)

const SPRING_TRANSITION = {
  type: 'spring',
  stiffness: 300,
  damping: 26, // sedikit underdamped -> settle dengan overshoot rotasi yang lembut
  mass: 0.8,
}

// Spring untuk merilekskan dragX kembali ke 0 saat lepas
const RELAX_SPRING = { type: 'spring', stiffness: 380, damping: 30 }

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

function getCardConfig(diff) {
  if (diff < 0) {
    // Kartu yang sudah di-swipe ke kiri (history)
    return {
      x: diff === -1 ? '-108%' : '-120%',
      y: 0,
      scale: 0.96,
      opacity: 0,
      brightness: 1,
      zIndex: 25, // Saat kembali dari kiri, meluncur di atas tumpukan
      pointerEvents: 'none',
      cursor: 'default',
    }
  }

  if (diff === 0) {
    // Kartu aktif di paling depan
    return {
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      brightness: 1,
      zIndex: 20,
      pointerEvents: 'auto',
      cursor: 'grab',
    }
  }

  if (diff === 1) {
    // Kartu ke-1 di belakang tumpukan (peek 1) — solid, hanya digelapkan
    return {
      x: 0,
      y: -20,
      scale: 0.96,
      opacity: 1,
      brightness: 0.92,
      zIndex: 15,
      pointerEvents: 'auto', // Bisa di-tap untuk loncat ke kartu ini
      cursor: 'pointer',
    }
  }

  if (diff === 2) {
    // Kartu ke-2 di belakang tumpukan (peek 2) — solid, hanya digelapkan
    return {
      x: 0,
      y: -38,
      scale: 0.925,
      opacity: 1,
      brightness: 0.84,
      zIndex: 10,
      pointerEvents: 'auto',
      cursor: 'pointer',
    }
  }

  if (diff === 3) {
    // Kartu ke-3 di belakang tumpukan (peek 3) — solid, hanya digelapkan
    return {
      x: 0,
      y: -56,
      scale: 0.89,
      opacity: 1,
      brightness: 0.76,
      zIndex: 5,
      pointerEvents: 'none',
      cursor: 'default',
    }
  }

  // Kartu jauh di belakang
  return {
    x: 0,
    y: -80,
    scale: 0.86,
    opacity: 0,
    brightness: 0.7,
    zIndex: 1,
    pointerEvents: 'none',
    cursor: 'default',
  }
}

function haptic(ms = 10) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms)
    }
  } catch {}
}

/**
 * DeckCard — satu kartu dalam tumpukan.
 *
 * Dua lapis transform yang saling melengkapi (tidak berkonflik):
 * - LAPIS LUAR: posisi layout dari activeIdx (x/y/scale/opacity/brightness),
 *   dianimasikan spring saat index berganti + menampung gesture drag.
 * - LAPIS DALAM: ekspresi 3D yang didorong dragX/dragP (lift kartu aktif,
 *   fan-out kartu belakang). Selalu kembali ke netral saat tidak di-drag.
 * - ROTASI ada di level tumpukan (AccountDeck), bukan per kartu: seluruh deck
 *   miring sebagai satu blok kaku seperti setumpuk kartu fisik — tidak ada
 *   celah putih yang terbuka di antara kartu saat drag.
 */
function DeckCard({
  slide,
  diff,
  dragP,
  reduceMotion,
  transition,
  dragProps,
  shadowCls,
  label,
}) {
  const config = getCardConfig(diff)
  const isActive = diff === 0
  const isBehind = diff >= 1 && diff <= 3
  const isPeek = diff === 1 || diff === 2
  const allowExpr = !reduceMotion

  // Fan-out: tumpukan belakang "membuka" — naik seiring drag.
  // (Tanpa membesar: tumpukan solid, kartu belakang tetap tertutup kartu depan.)
  const fanY = useTransform(dragP, (p) =>
    isBehind && allowExpr ? -p * FAN_PER_DIFF * diff : 0
  )
  // Lift: kartu aktif sedikit membesar saat diangkat — kesan kartu fisik
  // yang dicomot dari tumpukan.
  const exprScale = useTransform(dragP, (p) =>
    isActive && allowExpr ? 1 + p * LIFT_SCALE : 1
  )

  return (
    <motion.div
      key={slide.id}
      initial={false}
      animate={{
        x: config.x,
        y: config.y,
        scale: config.scale,
        opacity: config.opacity,
        filter: `brightness(${config.brightness})`,
      }}
      transition={transition}
      style={{
        zIndex: config.zIndex,
        touchAction: 'pan-y',
        transformOrigin: 'bottom center',
        pointerEvents: config.pointerEvents,
      }}
      className={cn(
        'absolute inset-0 h-full w-full select-none transform-gpu will-change-transform',
        isActive && 'cursor-grab active:cursor-grabbing',
        isPeek && 'cursor-pointer'
      )}
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      aria-hidden={!isActive}
      {...(isPeek ? dragProps.peekHandlers : {})}
    >
      <motion.div
        style={{ y: fanY, scale: exprScale, transformOrigin: 'bottom center' }}
        className="h-full w-full transform-gpu will-change-transform"
        {...(isActive ? dragProps.activeHandlers : {})}
      >
        <div className={cn('h-full w-full rounded-2xl transition-shadow duration-300', shadowCls)}>
          {slide.node}
        </div>
      </motion.div>
    </motion.div>
  )
}

export default function AccountDeck({
  slides = [],
  index = 0,
  onIndexChange,
  regionLabel = 'Bank Accounts',
  className,
}) {
  const reduceMotion = useReducedMotion()
  const trackRef = useRef(null)
  const frameRef = useRef(null)
  const dimsRef = useRef({ w: 350, h: 221 }) // ukuran frame kartu, diukur saat drag mulai
  const total = slides.length

  const [activeIdx, setActiveIdx] = useState(() =>
    Math.max(0, Math.min(index || 0, Math.max(0, total - 1)))
  )
  const [announcement, setAnnouncement] = useState('')
  const [lifting, setLifting] = useState(false)

  // Motion value bersama untuk ekspresi 3D saat drag:
  // dragX = offset horizontal kartu aktif, dragP = progres 0..1.
  const dragX = useMotionValue(0)
  const dragP = useTransform(dragX, (x) => Math.min(1, Math.abs(x) / DRAG_FULL))

  // TUMPUKAN SOLID: seluruh deck miring + terangkat sebagai satu blok kaku
  // (seperti memegang setumpuk kartu fisik). Karena semua kartu berbagi sudut
  // yang sama, tidak ada celah putih yang terbuka di antara kartu saat drag.
  const allowStackExpr = !reduceMotion
  const stackRotate = useTransform(dragX, (x) =>
    allowStackExpr ? clamp(-x * TILT_FACTOR, -TILT_MAX, TILT_MAX) : 0
  )
  const stackLift = useTransform(dragP, (p) => (allowStackExpr ? 1 + p * 0.02 : 1))
  // ANTI-CLIP: saat tumpukan miring, sudut kartu terangkat setinggi
  // sin(tilt) * setengah-lebar — tanpa kompensasi, sudutnya naik melewati ruang
  // atas dan melukis ke area header. Seluruh blok ditenggelamkan dengan jumlah
  // yang sama (+ pertumbuhan lift kartu aktif), jadi sudut tidak pernah
  // melewati ruang atas yang tersedia. Terasa seperti menekan tumpukan fisik.
  const stackSink = useTransform(dragX, (x) => {
    if (!allowStackExpr) return 0
    const t = Math.min(1, Math.abs(x) / DRAG_FULL)
    if (t <= 0) return 0
    const { w, h } = dimsRef.current
    const tiltRise = Math.sin(((t * TILT_MAX * Math.PI) / 180)) * (w / 2)
    const liftRise = t * LIFT_SCALE * h
    return tiltRise + liftRise
  })

  const goTo = useCallback(
    (next) => {
      const clamped = Math.max(0, Math.min(next, total - 1))
      if (clamped === activeIdx) return
      setActiveIdx(clamped)
      onIndexChange?.(clamped)
      haptic(10)
    },
    [activeIdx, total, onIndexChange]
  )

  const handleDrag = useCallback(
    (_, info) => {
      dragX.set(info.offset.x)
    },
    [dragX]
  )

  const handleDragStart = useCallback(() => {
    setLifting(true)
    // Ukur frame aktual (responsif) agar kompensasi sink presisi
    if (frameRef.current) {
      dimsRef.current = {
        w: frameRef.current.clientWidth || 350,
        h: frameRef.current.clientHeight || 221,
      }
    }
  }, [])

  const relaxDrag = useCallback(() => {
    setLifting(false)
    animate(dragX, 0, RELAX_SPRING)
  }, [dragX])

  const handleDragEnd = useCallback(
    (_, info) => {
      const { offset, velocity } = info
      relaxDrag()
      // Swipe ke kiri -> kartu berikutnya
      if (offset.x < -SWIPE_OFFSET || velocity.x < -SWIPE_VELOCITY) {
        if (activeIdx < total - 1) {
          goTo(activeIdx + 1)
          return
        }
      }
      // Swipe ke kanan -> kartu sebelumnya
      else if (offset.x > SWIPE_OFFSET || velocity.x > SWIPE_VELOCITY) {
        if (activeIdx > 0) {
          goTo(activeIdx - 1)
          return
        }
      }
      // Di bawah threshold: Framer Motion otomatis menganimasikan kembali ke animate={{ x: 0 }}
    },
    [activeIdx, total, goTo, relaxDrag]
  )

  // Sinkronisasi index dari kontrol luar (seperti klik dot pagination)
  useEffect(() => {
    const clamped = Math.max(0, Math.min(index ?? 0, Math.max(0, total - 1)))
    if (clamped !== activeIdx) {
      setActiveIdx(clamped)
    }
  }, [index, total, activeIdx])

  // Cegah index overflow bila list akun berubah
  useEffect(() => {
    setActiveIdx((prev) => Math.max(0, Math.min(prev, Math.max(0, total - 1))))
  }, [total])

  // Screen reader announcement
  useEffect(() => {
    const s = slides[activeIdx]
    if (s) setAnnouncement(`Kartu ${activeIdx + 1} dari ${total}: ${s.label}`)
  }, [activeIdx, slides, total])

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      goTo(activeIdx + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      goTo(activeIdx - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      goTo(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      goTo(total - 1)
    }
  }

  const transition = useMemo(
    () => (reduceMotion ? { duration: 0 } : SPRING_TRANSITION),
    [reduceMotion]
  )

  return (
    <div className={cn('relative', className)}>
      <div
        ref={trackRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={regionLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        // Tanpa overflow-hidden: sudut kartu yang miring saat drag tidak terpotong
        // tepi samping — kartu terlihat penuh seperti di preview. Kliping atas
        // tidak diperlukan karena stackSink menenggelamkan blok secukupnya;
        // overflow-x halaman diamankan via overflow-x-clip di root HomeTab.
        className="relative pt-[45px] pb-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        {/* Frame deck aspect ratio standar kartu ATM/Bank (1.58 : 1) — Kunci di Tablet */}
        <div ref={frameRef} className="relative aspect-[1.58/1] min-h-[190px] w-full max-w-[390px] sm:max-w-[420px] mx-auto select-none">
          {/* Wrapper tumpukan solid: rotasi + lift di level blok */}
          <motion.div
            style={{ rotate: stackRotate, scale: stackLift, y: stackSink, transformOrigin: 'bottom center' }}
            className="absolute inset-0 transform-gpu will-change-transform"
          >
          {slides.map((slide, i) => {
            const diff = i - activeIdx
            const isActive = diff === 0

            // Optimasi render: kartu yang terlalu jauh di belakang/depan disembunyikan
            if (diff < -2 || diff > 4) {
              return null
            }

            // Shadow: kartu terangkat (lifting) dapat bayangan lebih besar,
            // meniru kartu yang "diangkat" dari tumpukan seperti di referensi.
            // Semua varian diawali hairline ring 1px (0,0,0 ~18%) — menutup
            // fringe putih anti-aliasing saat kartu gelap berotasi di atas
            // background terang, sekaligus memberi definisi tepi kartu terang.
            // (ditulis literal penuh agar terbaca pemindai Tailwind)
            const shadowCls =
              isActive && lifting
                ? 'shadow-[0_0_0_1px_rgba(0,0,0,0.18),0_2px_6px_rgba(16,16,20,0.10),0_26px_50px_-12px_rgba(16,16,20,0.38)] dark:shadow-[0_0_0_1px_rgba(0,0,0,0.18),0_2px_6px_rgba(0,0,0,0.5),0_26px_50px_-12px_rgba(0,0,0,0.7)]'
                : isActive
                  ? 'shadow-[0_0_0_1px_rgba(0,0,0,0.18),0_1px_2px_rgba(16,16,20,0.06),0_14px_30px_-10px_rgba(16,16,20,0.22)] dark:shadow-[0_0_0_1px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.4),0_14px_30px_-10px_rgba(0,0,0,0.5)]'
                  : 'shadow-[0_0_0_1px_rgba(0,0,0,0.18),0_1px_2px_rgba(16,16,20,0.05),0_8px_18px_-8px_rgba(16,16,20,0.13)] dark:shadow-[0_0_0_1px_rgba(0,0,0,0.18),0_1px_2px_rgba(0,0,0,0.3),0_8px_18px_-8px_rgba(0,0,0,0.35)]'

            return (
              <DeckCard
                key={slide.id}
                slide={slide}
                diff={diff}
                dragP={dragP}
                reduceMotion={reduceMotion}
                transition={transition}
                shadowCls={shadowCls}
                label={slide.label}
                dragProps={{
                  activeHandlers: {
                    drag: isActive && !reduceMotion ? 'x' : false,
                    dragConstraints: { left: 0, right: 0 },
                    dragElastic: 0.4,
                    dragMomentum: false,
                    onDrag: handleDrag,
                    onDragStart: handleDragStart,
                    onDragEnd: handleDragEnd,
                  },
                  peekHandlers: {
                    onClick: () => goTo(i),
                  },
                }}
              />
            )
          })}
          </motion.div>
        </div>
      </div>

      {/* Live region pengumuman screen reader */}
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  )
}
