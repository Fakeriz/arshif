'use client'

import { useEffect, useRef, useState } from 'react'
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion'
import { useHaptic } from '@/hooks/useHaptic'
import { useApp } from './context'
import {
  Home6Outline,
  Home6Filled,
  TransactionMinusOutline,
  TransactionMinusFilled,
  PlusOutline,
  FlameOutline,
  FlameFilled,
  UserOutline,
  UserFilled,
} from './ReiconIcons'

const ITEMS = [
  {
    id: 'home',
    label: 'Home',
    Outline: Home6Outline,
    Filled: Home6Filled,
  },
  {
    id: 'transactions',
    label: 'Transactions',
    Outline: TransactionMinusOutline,
    Filled: TransactionMinusFilled,
  },
  {
    id: 'add',
    label: 'Add transaction',
    Outline: PlusOutline,
    Filled: PlusOutline,
  },
  {
    id: 'goals',
    label: 'Goals',
    Outline: FlameOutline,
    Filled: FlameFilled,
  },
  {
    id: 'more',
    label: 'Profile',
    Outline: UserOutline,
    Filled: UserFilled,
  },
]

const SPRING = {
  stiffness: 460,
  damping: 34,
  mass: 0.65,
}

const clamp = (value, min, max) =>
  Math.min(max, Math.max(min, value))

function isOpen(value) {
  if (!value) return false

  if (typeof value === 'boolean') return value

  if (typeof value === 'string') {
    return !['none', 'closed'].includes(value)
  }

  if (typeof value === 'object') {
    if ('open' in value) return value.open === true
    if ('isOpen' in value) return value.isOpen === true
    if ('visible' in value) return value.visible === true
    if ('status' in value) return value.status === 'open'
  }

  return false
}

export default function BottomNav({
  tab,
  onTab,
  onPlus,
  scrollContainerRef,
  modalOpen,
  onReselect,
}) {
  const app = useApp()
  const { t, open } = app || {}
  const haptic = useHaptic()
  const reduced = useReducedMotion()

  const navRef = useRef(null)
  const trackRef = useRef(null)
  const gesture = useRef(null)
  const suppressClick = useRef(false)

  const [width, setWidth] = useState(328)
  const [scrollVisible, setScrollVisible] = useState(true)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [pressed, setPressed] = useState(false)
  const [preview, setPreview] = useState(null)

  const selected = ITEMS.findIndex(
    item => item.id === tab && item.id !== 'add'
  )

  const active = preview ?? selected
  const cell = width / ITEMS.length

  const targetX = useMotionValue(0)
  const springX = useSpring(targetX, SPRING)
  const lensX = reduced ? targetX : springX
  const counterX = useTransform(lensX, value => -value)

  const contextOpen = [
    app?.modal,
    app?.activeModal,
    app?.activeSheet,
    app?.sheet,
    app?.currentModal,
    app?.subModal,
    app?.paywallOpen,
    app?.isPaywallOpen,
    ...Object.values(app?.sheets || {}),
  ].some(isOpen)

  const blocked = modalOpen ?? (sheetOpen || contextOpen)
  const visible = !blocked && scrollVisible

  useEffect(() => {
    const element = trackRef.current
    if (!element) return

    const measure = () => {
      setWidth(element.getBoundingClientRect().width)
    }

    measure()

    const observer = new ResizeObserver(measure)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!gesture.current) {
      targetX.set(Math.max(0, selected) * cell)
    }
  }, [selected, cell, targetX])

  useEffect(() => {
    const read = () => {
      const value = document.body.getAttribute('data-arshif-sheet-open')
      setSheetOpen(value !== null && value !== 'false' && value !== '0')
    }

    const toggle = event => {
      if (typeof event.detail?.open === 'boolean') {
        setSheetOpen(event.detail.open)
      } else {
        read()
      }
    }

    read()

    const observer = new MutationObserver(read)
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-arshif-sheet-open'],
    })

    window.addEventListener('arshif-sheet-toggle', toggle)

    return () => {
      observer.disconnect()
      window.removeEventListener('arshif-sheet-toggle', toggle)
    }
  }, [])

  useEffect(() => {
    const container = scrollContainerRef?.current
    const source = container || window

    const readY = () => {
      const max = container
        ? container.scrollHeight - container.clientHeight
        : document.documentElement.scrollHeight - window.innerHeight

      return clamp(
        container ? container.scrollTop : window.scrollY,
        0,
        Math.max(0, max)
      )
    }

    let last = readY()
    let distance = 0
    let direction = 0
    let frame = 0

    setScrollVisible(true)

    const update = () => {
      frame = 0

      const y = readY()
      const delta = y - last
      last = y

      const keyboardFocus =
        navRef.current?.contains(document.activeElement) &&
        document.activeElement?.matches(':focus-visible')

      if (blocked || gesture.current || keyboardFocus) {
        distance = 0
        return
      }

      if (y <= 30) {
        setScrollVisible(true)
        distance = 0
        return
      }

      if (Math.abs(delta) < 0.5) return

      const nextDirection = Math.sign(delta)
      distance = nextDirection === direction ? distance + Math.abs(delta) : Math.abs(delta)
      direction = nextDirection

      if (direction > 0 && y > 60 && distance >= 24) {
        setScrollVisible(false)
      }

      if (direction < 0 && distance >= 12) {
        setScrollVisible(true)
      }
    }

    const onScroll = () => {
      if (!frame) {
        frame = window.requestAnimationFrame(update)
      }
    }

    source.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      source.removeEventListener('scroll', onScroll)
      window.cancelAnimationFrame(frame)
    }
  }, [tab, blocked, scrollContainerRef])

  useEffect(() => {
    if (visible) return

    gesture.current = null
    setPressed(false)
    setPreview(null)
    targetX.set(Math.max(0, selected) * cell)

    const focused = document.activeElement
    if (navRef.current?.contains(focused)) {
      focused?.blur?.()
    }
  }, [visible, selected, cell, targetX])

  function feedback(kind) {
    try {
      if (typeof haptic?.[kind] === 'function') {
        haptic[kind]()
      } else if (typeof navigator !== 'undefined') {
        navigator.vibrate?.(8)
      }
    } catch {}
  }

  function activate(index) {
    if (!visible) return

    const id = ITEMS[index]?.id
    if (!id) return

    feedback(id === 'add' ? 'buttonPress' : 'toggleTab')

    if (id === 'add') {
      if (typeof onPlus === 'function') {
        onPlus()
      } else if (typeof open === 'function') {
        open('quickActions')
      }
    } else if (id === tab) {
      onReselect?.(id)
    } else {
      onTab?.(id)
    }
  }

  function pointerDown(event, index) {
    if (!visible || !event.isPrimary || event.button !== 0) return

    suppressClick.current = false

    gesture.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      index,
      dragging: false,
      rect: trackRef.current.getBoundingClientRect(),
    }

    setPressed(true)
    setPreview(index)
    targetX.set(index * cell)

    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function pointerMove(event) {
    const state = gesture.current
    if (!state || state.id !== event.pointerId) return

    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY

    if (!state.dragging && Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
      finish(event, true)
      return
    }

    if (!state.dragging && Math.abs(dx) < 5) return

    state.dragging = true

    const x = clamp(event.clientX - state.rect.left - cell / 2, 0, width - cell)
    targetX.set(x)

    const index = clamp(Math.round(x / cell), 0, ITEMS.length - 1)

    if (index !== state.index) {
      state.index = index
      setPreview(index)
      feedback('toggleTab')
    }
  }

  function finish(event, cancelled = false) {
    const state = gesture.current
    if (!state || state.id !== event.pointerId) return

    gesture.current = null
    setPressed(false)
    setPreview(null)

    suppressClick.current = cancelled || state.dragging

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    targetX.set(Math.max(0, selected) * cell)

    if (!cancelled && state.dragging) {
      activate(state.index)
    }
  }

  const iconLayers = (item, index) => (
    <span className="relative block h-[24px] w-[24px]" aria-hidden="true">
      <motion.span
        className="absolute inset-0"
        initial={false}
        animate={{
          opacity: active === index ? 0 : 1,
        }}
        transition={{
          duration: reduced ? 0 : 0.1,
        }}
      >
        <item.Outline className="h-full w-full" />
      </motion.span>

      <motion.span
        className="absolute inset-0"
        initial={false}
        animate={{
          opacity: active === index ? 1 : 0,
        }}
        transition={{
          duration: reduced ? 0 : 0.1,
        }}
      >
        <item.Filled className="h-full w-full" />
      </motion.span>
    </span>
  )

  return (
    <motion.nav
      ref={navRef}
      aria-label={t('aria_main_navigation')}
      aria-hidden={!visible}
      initial={false}
      animate={{
        y: visible ? 0 : 80,
        opacity: visible ? 1 : 0,
      }}
      transition={
        reduced
          ? { duration: 0 }
          : {
              type: 'spring',
              stiffness: 450,
              damping: 35,
              mass: 0.5,
            }
      }
      className="fixed inset-x-0 bottom-0 z-50 flex select-none justify-center px-4 pb-[max(8px,calc(env(safe-area-inset-bottom)-10px))] pointer-events-none transform-gpu"
    >
      <div
        style={{ pointerEvents: visible ? 'auto' : 'none' }}
        className="
          relative isolate h-[60px] w-full max-w-[360px]
          rounded-full p-[5px]
          text-zinc-950 dark:text-white
        "
      >
        {/* Background kaca */}
        <div
          aria-hidden="true"
          className="
            pointer-events-none absolute inset-0 z-0
            overflow-hidden rounded-full
            bg-white/[0.72] dark:bg-[#121214]/[0.75]
            border border-white/[0.45] dark:border-white/[0.08]
            shadow-[0_10px_32px_rgba(0,0,0,0.06),inset_0_1px_1px_rgba(255,255,255,0.65),inset_0_-1px_1px_rgba(0,0,0,0.04)]
            dark:shadow-[0_12px_40px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.12),inset_0_-1px_1px_rgba(0,0,0,0.3)]
          "
          style={{
            backdropFilter: 'blur(48px) saturate(200%)',
            WebkitBackdropFilter: 'blur(48px) saturate(200%)',
          }}
        >
          <div
            className="absolute inset-0 opacity-[0.55] dark:opacity-[0.18]"
            style={{
              background:
                'linear-gradient(180deg, rgba(255,255,255,0.48) 0%, rgba(255,255,255,0.14) 32%, rgba(255,255,255,0) 62%)',
            }}
          />
          <div
            className="absolute inset-x-[12%] top-0 h-px opacity-80 dark:opacity-40"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.85) 35%, rgba(255,255,255,0.85) 65%, transparent 100%)',
            }}
          />
          <div
            className="absolute inset-x-[20%] bottom-0 h-px opacity-40 dark:opacity-20"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent)',
            }}
          />
        </div>

        <div ref={trackRef} className="relative z-10 flex h-full w-full">
          {/* Lensa penanda tab aktif */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-20"
            style={{
              width: cell,
              x: lensX,
            }}
          >
            <motion.div
              className="absolute inset-[1px] rounded-full"
              initial={false}
              animate={{
                opacity: active < 0 ? 0 : 1,
                scaleX: pressed && !reduced ? 1.16 : 1,
                scaleY: pressed && !reduced ? 1.36 : 1,
              }}
              transition={
                reduced
                  ? { duration: 0 }
                  : {
                      type: 'spring',
                      ...SPRING,
                    }
              }
              style={{
                background: pressed
                  ? 'rgba(128,128,128,0.08)'
                  : 'rgba(128,128,128,0.18)',
                boxShadow: pressed
                  ? 'inset 0 1px 1px rgba(255,255,255,.65), inset 1px 0 1px rgba(120,205,255,.35), inset -1px -1px 1px rgba(235,223,130,.4), 0 3px 10px rgba(0,0,0,.12)'
                  : 'inset 0 1px 0 rgba(255,255,255,.08)',
              }}
            />

            <motion.div
              className="absolute inset-y-0 left-0 overflow-hidden rounded-full"
              style={{ width: cell }}
              initial={false}
              animate={{
                opacity: pressed && !reduced ? 1 : 0,
              }}
              transition={{ duration: 0.1 }}
            >
              <motion.div
                className="flex h-full"
                style={{
                  width,
                  x: counterX,
                }}
              >
                {ITEMS.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex h-full shrink-0 items-center justify-center"
                    style={{ width: cell }}
                  >
                    <span
                      style={{
                        transform: 'scale(1.12)',
                        filter: 'drop-shadow(1px 1px 0 rgba(213,222,90,.45))',
                      }}
                    >
                      {iconLayers(item, index)}
                    </span>
                  </div>
                ))}
              </motion.div>
            </motion.div>
          </motion.div>

          {ITEMS.map((item, index) => (
            <motion.button
              key={item.id}
              type="button"
              disabled={!visible}
              tabIndex={visible ? 0 : -1}
              aria-current={item.id === tab ? 'page' : undefined}
              aria-label={t?.(item.id === 'more' ? 'bottom_more' : item.id === 'add' ? 'bottom_add' : `bottom_${item.id}`) || item.label}
              data-testid={item.id === 'add' ? 'fab-add' : `nav-${item.id}`}
              className="
                relative flex h-full min-w-0 flex-1
                cursor-pointer items-center justify-center rounded-full
                focus-visible:outline focus-visible:outline-2
                focus-visible:outline-offset-2 focus-visible:outline-sky-500
              "
              style={{
                touchAction: 'pan-y',
                WebkitTapHighlightColor: 'transparent',
              }}
              whileTap={reduced ? undefined : { scale: 0.94 }}
              transition={{
                type: 'spring',
                ...SPRING,
              }}
              onPointerDown={event => pointerDown(event, index)}
              onPointerMove={pointerMove}
              onPointerUp={event => finish(event)}
              onPointerCancel={event => finish(event, true)}
              onLostPointerCapture={event => finish(event, true)}
              onClick={event => {
                if (suppressClick.current && event.detail !== 0) {
                  suppressClick.current = false
                  return
                }

                suppressClick.current = false
                activate(index)
              }}
            >
              {iconLayers(item, index)}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.nav>
  )
}