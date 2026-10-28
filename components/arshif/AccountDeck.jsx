'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'
import { CardEdgeSurface } from './BankCard'
import {
  cardLadder,
  deckAnnouncement,
  dragProgress,
  fanOffset,
  resolveKeyboard,
  resolveSwipe,
  tiltDegrees,
  liftScale,
  isRenderedCard,
  CARD_ASPECT,
  CARD_MIN_HEIGHT,
  CARD_WIDTH_RATIO,
} from '@/lib/accountDeck'

const RELAX_SPRING = { type: 'spring', stiffness: 380, damping: 30 }
const SPRING = { type: 'spring', stiffness: 300, damping: 26, mass: 0.8 }

function haptic(ms = 10) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms)
  } catch {}
}

function DeckCard({ slide, diff, slideIndex, total, reduceMotion, dragX, onSelect, onDragStart, onDrag, onDragEnd }) {
  const ladder = cardLadder(diff)
  const active = diff === 0
  const peek = diff === 1
  const progress = useTransform(dragX, (x) => dragProgress(x))
  const rotate = useTransform(dragX, (x) => (reduceMotion || !active ? 0 : tiltDegrees(x)))
  const lift = useTransform(progress, (p) => (reduceMotion || !active ? 1 : liftScale(p)))
  const fan = useTransform(progress, (p) => (reduceMotion || diff < 1 ? 0 : fanOffset(p, diff)))
  const transition = reduceMotion ? { duration: 0 } : SPRING
  const label = slide.label || `Slide ${slideIndex + 1}`

  return (
    <motion.div
      initial={false}
      animate={{
        x: `${ladder.percent}%`,
        y: ladder.y,
        scale: ladder.scale,
        opacity: ladder.opacity,
        filter: `brightness(${ladder.brightness})`,
      }}
      transition={transition}
      style={{
        width: `${CARD_WIDTH_RATIO * 100}%`,
        zIndex: ladder.zIndex,
        touchAction: 'pan-y',
        pointerEvents: ladder.opacity > 0 ? 'auto' : 'none',
        transformOrigin: 'bottom center',
      }}
      className={cn('absolute left-0 top-0 h-full select-none transform-gpu', active && 'cursor-grab active:cursor-grabbing')}
      role="group"
      aria-roledescription="slide"
      aria-label={label}
      aria-hidden={diff < 0 || diff > 1}
      aria-setsize={total}
      aria-posinset={slideIndex + 1}
      drag={active ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.4}
      dragMomentum={false}
      onDragStart={active ? onDragStart : undefined}
      onDrag={active ? onDrag : undefined}
      onDragEnd={active ? onDragEnd : undefined}
    >
      <motion.div
        className="h-full w-full rounded-[19px] transform-gpu"
        style={{ rotate, scale: lift, y: fan }}
      >
        {active ? (
          slide.node
        ) : peek ? (
          <button
            type="button"
            onClick={() => onSelect(slideIndex)}
            aria-label={`Pilih kartu ${label}`}
            className="block h-full w-full cursor-pointer appearance-none rounded-[19px] border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <CardEdgeSurface accent={slide.accent} label={label} />
          </button>
        ) : (
          <CardEdgeSurface accent={slide.accent} label={label} />
        )}
      </motion.div>
    </motion.div>
  )
}

export default function AccountDeck({ slides = [], index = 0, onIndexChange, regionLabel = 'Bank Accounts', className }) {
  const reduceMotion = useReducedMotion()
  const total = slides.length
  const regionRef = useRef(null)
  const [activeIdx, setActiveIdx] = useState(() => Math.max(0, Math.min(index || 0, Math.max(0, total - 1))))
  const [announcement, setAnnouncement] = useState('')
  const dragX = useMotionValue(0)

  const goTo = useCallback((next) => {
    if (!total) return
    const clamped = Math.max(0, Math.min(next, total - 1))
    setActiveIdx((current) => {
      if (current === clamped) return current
      // Gauging focus: the peek control disappears when its card becomes active,
      // so hand focus back to the carousel instead of dropping it to the body.
      const region = regionRef.current
      if (region && region.contains(document.activeElement) && document.activeElement !== region) {
        region.focus({ preventScroll: true })
      }
      onIndexChange?.(clamped)
      haptic()
      return clamped
    })
  }, [onIndexChange, total])

  useEffect(() => {
    const next = Math.max(0, Math.min(index ?? 0, Math.max(0, total - 1)))
    setActiveIdx(next)
  }, [index, total])

  useEffect(() => {
    setActiveIdx((current) => Math.max(0, Math.min(current, Math.max(0, total - 1))))
  }, [total])

  useEffect(() => {
    const slide = slides[activeIdx]
    if (slide) setAnnouncement(deckAnnouncement(activeIdx, total, slide.label))
  }, [activeIdx, slides, total])

  const handleDragStart = useCallback(() => dragX.set(0), [dragX])
  const handleDrag = useCallback((_, info) => dragX.set(info.offset.x), [dragX])
  const handleDragEnd = useCallback((_, info) => {
    animate(dragX, 0, reduceMotion ? { duration: 0 } : RELAX_SPRING)
    const next = resolveSwipe(info.offset.x, info.velocity.x, activeIdx, total)
    if (next !== null) goTo(next)
  }, [activeIdx, dragX, goTo, reduceMotion, total])

  const onKeyDown = useCallback((event) => {
    const next = resolveKeyboard(event.key, activeIdx, total)
    if (next === null) return
    event.preventDefault()
    goTo(next)
  }, [activeIdx, goTo, total])

  if (!total) return null

  return (
    <div className={cn('relative', className)}>
      <div
        ref={regionRef}
        role="region"
        aria-roledescription="carousel"
        aria-label={regionLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative mx-auto w-full max-w-[420px] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="relative pt-6 pb-6">
          {/* The deck frame defines the peek: the stack is clipped horizontally
              at the deck edges, so the next card reads as a full-height sliver
              inside the frame instead of spilling into the page gutter. Vertical
              overflow stays visible so tilt and fan are not cut off. */}
          <div className="relative w-full overflow-x-clip" data-testid="account-deck-frame">
            {/* Height spacer mirrors the focal card box (85% wide, 1.58 ratio,
                185px floor), so every stack layer is exactly the focal card's
                height at every width. */}
            <div
              aria-hidden="true"
              className="invisible"
              style={{ width: `${CARD_WIDTH_RATIO * 100}%`, aspectRatio: `${CARD_ASPECT} / 1`, minHeight: CARD_MIN_HEIGHT }}
            />
            <div className="absolute inset-0">
              {slides.map((slide, slideIndex) => {
                const diff = slideIndex - activeIdx
                if (!isRenderedCard(diff)) return null
                return (
                  <DeckCard
                    key={slide.id}
                    slide={slide}
                    diff={diff}
                    slideIndex={slideIndex}
                    total={total}
                    reduceMotion={Boolean(reduceMotion)}
                    dragX={dragX}
                    onSelect={goTo}
                    onDragStart={handleDragStart}
                    onDrag={handleDrag}
                    onDragEnd={handleDragEnd}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <div aria-live="polite" className="sr-only">{announcement}</div>
    </div>
  )
}
