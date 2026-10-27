'use client'

import { useCallback, useMemo } from 'react'

/**
 * Standard haptic vibration patterns (in milliseconds)
 * Adheres to pure monochrome minimalist tactile feedback.
 */
export const HAPTIC_PATTERNS = {
  // Button press: swift crisp tap
  buttonPress: 10,
  button: 10,
  press: 10,
  tap: 10,
  light: 10,

  // Toggling tabs: smooth medium tactile feedback
  toggleTab: 18,
  tab: 18,
  switchTab: 18,
  medium: 18,

  // Successful transactions: rhythmic multi-pulse confirmation
  successfulTransaction: [15, 50, 20],
  successTransaction: [15, 50, 20],
  transactionSuccess: [15, 50, 20],
  success: [15, 50, 20],

  // Additional system patterns
  selection: 8,
  heavy: 30,
  warning: [20, 60, 20],
  error: [30, 70, 30, 70, 40],
}

/**
 * Direct helper to trigger haptics using window?.navigator?.vibrate
 * Adheres to optional chaining defensive coding standard.
 *
 * @param {string|number|number[]} typeOrPattern
 * @returns {boolean} Whether vibration was initiated
 */
export function triggerHaptic(typeOrPattern = 'buttonPress') {
  if (typeof window === 'undefined') return false
  try {
    const pattern =
      typeof typeOrPattern === 'string'
        ? (HAPTIC_PATTERNS[typeOrPattern] ?? 10)
        : (typeOrPattern ?? 10)

    return Boolean(window?.navigator?.vibrate?.(pattern))
  } catch {
    return false
  }
}

/**
 * Custom React hook for triggering haptic feedback patterns
 * specifically designed for user interactions such as button presses,
 * successful transactions, and toggling tabs.
 *
 * Can be called as a function:
 *   const haptic = useHaptic()
 *   haptic('buttonPress')
 *
 * Or destructured for dedicated action handlers:
 *   const { buttonPress, successfulTransaction, toggleTab } = useHaptic()
 *   buttonPress()
 *   successfulTransaction()
 *   toggleTab()
 */
export function useHaptic() {
  const isSupported =
    typeof window !== 'undefined' &&
    Boolean(window?.navigator?.vibrate)

  const trigger = useCallback((typeOrPattern = 'buttonPress') => {
    return triggerHaptic(typeOrPattern)
  }, [])

  const buttonPress = useCallback(() => {
    return triggerHaptic(HAPTIC_PATTERNS.buttonPress)
  }, [])

  const successfulTransaction = useCallback(() => {
    return triggerHaptic(HAPTIC_PATTERNS.successfulTransaction)
  }, [])

  const toggleTab = useCallback(() => {
    return triggerHaptic(HAPTIC_PATTERNS.toggleTab)
  }, [])

  // Aliases for convenience
  const light = useCallback(() => triggerHaptic('light'), [])
  const medium = useCallback(() => triggerHaptic('medium'), [])
  const heavy = useCallback(() => triggerHaptic('heavy'), [])
  const success = useCallback(() => triggerHaptic('success'), [])
  const warning = useCallback(() => triggerHaptic('warning'), [])
  const error = useCallback(() => triggerHaptic('error'), [])
  const selection = useCallback(() => triggerHaptic('selection'), [])

  return useMemo(() => {
    // Allow the return value to be both callable as a function and an object with methods
    const fn = (typeOrPattern) => trigger(typeOrPattern)

    Object.assign(fn, {
      trigger,
      vibrate: trigger,
      buttonPress,
      button: buttonPress,
      press: buttonPress,
      tap: buttonPress,
      successfulTransaction,
      successTransaction: successfulTransaction,
      transactionSuccess: successfulTransaction,
      success: successfulTransaction,
      toggleTab,
      tab: toggleTab,
      switchTab: toggleTab,
      light,
      medium,
      heavy,
      warning,
      error,
      selection,
      isSupported,
      patterns: HAPTIC_PATTERNS,
    })

    return fn
  }, [
    trigger,
    buttonPress,
    successfulTransaction,
    toggleTab,
    light,
    medium,
    heavy,
    warning,
    error,
    selection,
    isSupported,
  ])
}

export default useHaptic
