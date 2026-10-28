import assert from 'node:assert/strict'
import test from 'node:test'
import {
  CARD_WIDTH_RATIO,
  MAX_VISIBLE_CARDS,
  PEEK_RATIO,
  activeCardWidthPx,
  cardLadder,
  cardOffsetPx,
  deckAnnouncement,
  dragProgress,
  fanOffset,
  isRenderedCard,
  liftScale,
  peekWidthPx,
  resolveKeyboard,
  resolveSwipe,
  tiltDegrees,
} from '../lib/accountDeck.js'

// Reference viewport from the handoff: 390px wide with the app's 20px gutters.
const DECK_WIDTH_390 = 350
const DECK_WIDTH_320 = 280

test('active card is 84-86% of the deck width with a 14-16% peek', () => {
  assert.ok(CARD_WIDTH_RATIO >= 0.84 && CARD_WIDTH_RATIO <= 0.86)
  assert.ok(PEEK_RATIO >= 0.14 && PEEK_RATIO <= 0.16)

  assert.equal(activeCardWidthPx(DECK_WIDTH_390), 297.5)
  assert.equal(peekWidthPx(DECK_WIDTH_390), 52.5)

  const share = activeCardWidthPx(DECK_WIDTH_390) / DECK_WIDTH_390
  assert.ok(share >= 0.84 && share <= 0.86)

  // 320px: the peek stays visible and nothing is pushed off-screen.
  assert.ok(peekWidthPx(DECK_WIDTH_320) > 0)
  assert.ok(activeCardWidthPx(DECK_WIDTH_320) + peekWidthPx(DECK_WIDTH_320) <= DECK_WIDTH_320)
})

test('next card left edge sits at the peek boundary in both px and transform percent', () => {
  assert.equal(cardOffsetPx(1, DECK_WIDTH_390), 297.5)
  assert.equal(cardOffsetPx(0, DECK_WIDTH_390), 0)
  assert.equal(cardLadder(1).percent, 100)
  assert.equal(cardLadder(2).percent, 105)
})

test('deck keeps at most three legible cards and hides the rest', () => {
  assert.equal(MAX_VISIBLE_CARDS, 3)

  const active = cardLadder(0)
  const peek = cardLadder(1)
  const third = cardLadder(2)
  const fourth = cardLadder(3)

  assert.deepEqual([active.scale, active.brightness, active.opacity], [1, 1, 1])
  assert.deepEqual([peek.scale, peek.brightness], [0.96, 0.94])
  assert.deepEqual([third.scale, third.brightness], [0.92, 0.84])
  assert.equal(fourth.opacity, 0)

  const legible = [0, 1, 2, 3, 4].filter((diff) => cardLadder(diff).opacity > 0)
  assert.equal(legible.length, MAX_VISIBLE_CARDS)

  assert.equal(isRenderedCard(2), true)
  assert.equal(isRenderedCard(3), false)
  assert.equal(isRenderedCard(-2), false)
})

test('drag tilt never exceeds 7 degrees', () => {
  assert.equal(tiltDegrees(-500), 7)
  assert.equal(tiltDegrees(500), -7)
  assert.equal(tiltDegrees(0), 0)
  for (const offset of [-400, -140, -45, 0, 45, 140, 400]) {
    assert.ok(Math.abs(tiltDegrees(offset)) <= 7)
  }
})

test('drag lift never exceeds 1.03 scale', () => {
  assert.equal(liftScale(0), 1)
  assert.equal(liftScale(1), 1.03)
  assert.equal(liftScale(2), 1.03)
  assert.equal(dragProgress(70), 0.5)
  assert.equal(dragProgress(999), 1)
  assert.equal(dragProgress(-140), 1)
})

test('back cards fan upward by 4-8px and the active card stays put', () => {
  assert.equal(fanOffset(1, 0), 0)
  assert.equal(fanOffset(1, -1), 0)
  assert.equal(fanOffset(0, 1), 0)
  assert.equal(fanOffset(1, 1), -4)
  assert.equal(fanOffset(1, 2), -8)
  assert.equal(fanOffset(1, 3), -8)
})

test('swipe threshold fires at 45px or 220px/s and respects the deck edges', () => {
  assert.equal(resolveSwipe(-44, -219, 0, 5), null)
  assert.equal(resolveSwipe(-45, 0, 0, 5), 1)
  assert.equal(resolveSwipe(-10, -220, 0, 5), 1)
  assert.equal(resolveSwipe(45, 0, 2, 5), 1)
  assert.equal(resolveSwipe(10, 220, 2, 5), 1)
  assert.equal(resolveSwipe(-45, 0, 4, 5), null)
  assert.equal(resolveSwipe(45, 0, 0, 5), null)
})

test('keyboard arrows, Home and End resolve to clamped indexes', () => {
  assert.equal(resolveKeyboard('ArrowRight', 0, 5), 1)
  assert.equal(resolveKeyboard('ArrowLeft', 3, 5), 2)
  assert.equal(resolveKeyboard('Home', 4, 5), 0)
  assert.equal(resolveKeyboard('End', 1, 5), 4)
  assert.equal(resolveKeyboard('ArrowLeft', 0, 5), 0)
  assert.equal(resolveKeyboard('ArrowRight', 4, 5), 4)
  assert.equal(resolveKeyboard('Enter', 1, 5), null)
})

test('live announcement names the card and its position', () => {
  assert.equal(deckAnnouncement(1, 5, 'Maybank'), 'Kartu 2 dari 5: Maybank')
})
