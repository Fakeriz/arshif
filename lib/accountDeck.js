// Deck geometry and swipe decisions for AccountDeck.
// Framework-free so the numbers in SWIPE-CARD-HANDOFF.md stay verifiable in tests.

export const SWIPE_OFFSET = 45
export const SWIPE_VELOCITY = 220

// Active card takes 84-86% of the deck content width; the remainder is the
// intentional peek of the next card (14-16%).
export const CARD_WIDTH_RATIO = 0.85
export const PEEK_RATIO = 0.15
export const MAX_VISIBLE_CARDS = 3

// Drag expression: 140px of drag reaches full expression.
export const DRAG_FULL = 140
export const TILT_MAX = 7
export const TILT_PER_PX = 0.06
export const LIFT_SCALE_MAX = 0.03
export const FAN_PER_DIFF = 4
export const FAN_MAX = 8

// The third card sits a little further right so its edge stays visible.
const THIRD_CARD_OFFSET_STEP = 0.05

// Surface palette from SWIPE-CARD-HANDOFF.md. One file owns these values so the
// canvas, the raised surfaces and the single focal gradient cannot drift apart.
export const DECK_CANVAS = '#090A0D'
export const DECK_SURFACE = '#12151B'
export const DECK_SURFACE_ALT = '#191D25'
export const FOCAL_FROM = '#FF5F6D'
export const FOCAL_TO = '#FF9966'
// White on #FF5F6D is 2.95:1, so focal-card ink is near-black (6.70:1 at the
// coral end, 8.05:1 at the orange end).
export const FOCAL_INK = '#090A0D'

export const DECK_EDGE_ACCENT = '#8B929E'

// One accent edge per account theme. It is the only identity hint left on a card
// that is not the focal card, so it marks the account, not decoration.
export const EDGE_ACCENTS = {
  parang: '#D4AF37',
  glacier: '#6A92FC',
  obsidian: '#6A92FC',
  kawung: '#6A92FC',
  spider: '#FF5E6C',
  matrix: '#2DD4BF',
}

export const edgeAccent = (theme) => EDGE_ACCENTS[theme] || DECK_EDGE_ACCENT

const HIDDEN_CARD = { offsetRatio: 1.05, percent: 105, y: -8, scale: 0.92, brightness: 0.84, opacity: 0, zIndex: 0 }
const LEFT_HIDDEN_CARD = { percent: -100, y: 0, scale: 0.96, brightness: 0.94, opacity: 0, zIndex: 25 }

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

// Keeps -0 out of inline transforms.
const noNegativeZero = (value) => (value === 0 ? 0 : value)

export const activeCardWidthPx = (containerWidth) => containerWidth * CARD_WIDTH_RATIO

export const peekWidthPx = (containerWidth) => containerWidth * PEEK_RATIO

// Offset of a card relative to the active card, as a ratio of container width.
export function cardOffsetRatio(diff) {
  if (diff <= 0) return diff * CARD_WIDTH_RATIO
  if (diff === 1) return CARD_WIDTH_RATIO
  return CARD_WIDTH_RATIO * (1 + THIRD_CARD_OFFSET_STEP)
}

export const cardOffsetPx = (diff, containerWidth) => cardOffsetRatio(diff) * containerWidth

// Percentage is measured against the card's own width, which is what
// framer-motion x transforms use.
export const cardOffsetPercent = (diff) => (cardOffsetRatio(diff) / CARD_WIDTH_RATIO) * 100

export function dragProgress(offsetX) {
  return clamp(Math.abs(Number(offsetX) || 0) / DRAG_FULL, 0, 1)
}

export function tiltDegrees(offsetX) {
  return noNegativeZero(clamp(-(Number(offsetX) || 0) * TILT_PER_PX, -TILT_MAX, TILT_MAX))
}

export function liftScale(progress) {
  return 1 + clamp(Number(progress) || 0, 0, 1) * LIFT_SCALE_MAX
}

// Back cards fan upward 4-8px while the active card is being dragged.
export function fanOffset(progress, diff) {
  if (diff < 1) return 0
  return noNegativeZero(-clamp(Number(progress) || 0, 0, 1) * Math.min(FAN_MAX, FAN_PER_DIFF * diff))
}

export function cardLadder(diff) {
  const percent = cardOffsetPercent(diff)

  if (diff <= -1) return LEFT_HIDDEN_CARD
  if (diff === 0) return { percent, y: 0, scale: 1, brightness: 1, opacity: 1, zIndex: 30 }
  if (diff === 1) return { percent, y: 0, scale: 0.96, brightness: 0.94, opacity: 1, zIndex: 20 }
  if (diff === 2) return { percent, y: -14, scale: 0.92, brightness: 0.84, opacity: 1, zIndex: 10 }
  return HIDDEN_CARD
}

export const isActiveCard = (diff) => diff === 0
export const isPeekCard = (diff) => diff === 1
export const isRenderedCard = (diff) => diff >= -1 && diff <= MAX_VISIBLE_CARDS - 1

// Returns the next index when the gesture passes the threshold, else null.
export function resolveSwipe(offsetX, velocityX, activeIdx, total) {
  const last = Math.max(0, total - 1)
  const from = clamp(activeIdx, 0, last)
  const dx = Number(offsetX) || 0
  const vx = Number(velocityX) || 0

  if (dx <= -SWIPE_OFFSET || vx <= -SWIPE_VELOCITY) return from < last ? from + 1 : null
  if (dx >= SWIPE_OFFSET || vx >= SWIPE_VELOCITY) return from > 0 ? from - 1 : null
  return null
}

export function resolveKeyboard(key, activeIdx, total) {
  const last = Math.max(0, total - 1)
  const from = clamp(activeIdx, 0, last)

  if (key === 'ArrowRight') return clamp(from + 1, 0, last)
  if (key === 'ArrowLeft') return clamp(from - 1, 0, last)
  if (key === 'Home') return 0
  if (key === 'End') return last
  return null
}

export function deckAnnouncement(index, total, label) {
  return `Kartu ${index + 1} dari ${total}: ${label || ''}`.trim()
}
