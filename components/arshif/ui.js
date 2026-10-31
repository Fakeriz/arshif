'use client'
import React, { useEffect, useMemo, Component } from 'react'
import { AnimatePresence, motion, useDragControls } from 'framer-motion'
import { cn, triggerHaptic } from '@/lib/utils'
import { useApp } from './context'
import {
  Utensils, ShoppingBasket, Car, ShoppingBag, Receipt, Clapperboard, HeartPulse, GraduationCap, Plane, Home, User,
  Briefcase, Wallet, Laptop, TrendingUp, Gift, ArrowLeftRight, CircleDashed, X, Check,
  CreditCard, Banknote, Landmark, Smartphone, BarChart3, Vault, PiggyBank, Bitcoin, Calendar,
} from 'lucide-react'
import { getCategory, getLogo } from '@/lib/categories'

const ICONS = { Utensils, ShoppingBasket, Car, ShoppingBag, Receipt, Clapperboard, HeartPulse, GraduationCap, Plane, Home, User, Briefcase, Wallet, Laptop, TrendingUp, Gift, ArrowLeftRight, CircleDashed }

// Icons usable by outline bank/e-wallet logos and account icons.
export const LOGO_ICONS = { CreditCard, Banknote, Landmark, Smartphone, BarChart3, Vault, PiggyBank, Bitcoin, Wallet, TrendingUp, Briefcase }

export function CategoryIcon({ id, className, size = 18 }) {
  const cat = getCategory(id)
  const Icon = ICONS[cat?.icon] || CircleDashed
  return <Icon size={size} className={className} strokeWidth={2} />
}

export function CategoryBadge({ id, className, size = 'md' }) {
  const dims = size === 'lg' ? 'h-14 w-14 rounded-2xl' : size === 'sm' ? 'h-9 w-9 rounded-xl' : 'h-11 w-11 rounded-2xl'
  return (
    <div className={cn('flex items-center justify-center bg-[#0c0c0e] text-white dark:bg-white dark:text-[#0c0c0e] shrink-0', dims, className)}>
      <CategoryIcon id={id} size={size === 'lg' ? 24 : size === 'sm' ? 16 : 18} />
    </div>
  )
}

export function LogoBadge({ logoId, className, size = 'md' }) {
  const logo = getLogo(logoId)
  const dims = size === 'lg' ? 'h-12 w-12 text-sm' : size === 'bank' ? 'w-12 h-12 text-[11px]' : size === 'sm' ? 'h-7 w-7 text-[9px]' : 'h-9 w-9 text-[10px]'
  const iconSize = size === 'lg' ? 22 : size === 'bank' ? 20 : size === 'sm' ? 14 : 18
  if (!logo) return <div className={cn('rounded-xl bg-muted/60 dark:bg-white/10 border border-border/60 shrink-0', dims, className)} />
  if (logo.outline) {
    const Icon = LOGO_ICONS[logo.icon] || Wallet
    return (
      <div className={cn('rounded-xl flex items-center justify-center border border-current text-current shrink-0', dims, className)}>
        <Icon size={iconSize} strokeWidth={1.5} />
      </div>
    )
  }
  return (
    <div className={cn('rounded-xl flex items-center justify-center font-extrabold tracking-tight shrink-0 select-none shadow-xs', dims, className)} style={{ background: logo.color, color: logo.dark ? '#111' : '#fff' }}>
      {logo.short}
    </div>
  )
}

export function SectionLabel({ children, className }) {
  return <p className={cn('text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground', className)}>{children}</p>
}

export function Segmented({ options = [], value, onChange, className, size = 'md' }) {
  return (
    <div className={cn('flex bg-muted/70 dark:bg-[#121214] border border-border/50 rounded-2xl p-1 gap-1', className)}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => {
            triggerHaptic('light')
            onChange?.(o.id)
          }}
          className={cn(
            'flex-1 rounded-xl transition-all cursor-pointer',
            size === 'sm' ? 'py-1.5 text-xs' : 'py-2 text-sm',
            value === o.id
              ? 'bg-[#0c0c0e] text-white dark:bg-white dark:text-[#0c0c0e] font-bold shadow-xs'
              : 'text-muted-foreground hover:text-foreground font-semibold'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Pill({ active, children, onClick, className, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        triggerHaptic('light')
        onClick?.(e)
      }}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm transition-all cursor-pointer',
        active
          ? 'bg-[#0c0c0e] text-white border-[#0c0c0e] dark:bg-white dark:text-[#0c0c0e] dark:border-white font-bold shadow-xs'
          : 'bg-white dark:bg-[#121214] border-border/60 text-foreground font-medium hover:bg-muted/40',
        className
      )}
    >
      {Icon ? <Icon size={14} /> : null}
      {children}
    </button>
  )
}

// Satu-satunya switch di app. Ukuran h-7 w-12, warna aktif mengikuti
// PrimaryButton (zinc-950 / putih) supaya serasi di semua sheet.
export function Switch({ checked, onChange, disabled, className, ...props }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation()
        triggerHaptic('light')
        onChange?.(!checked)
      }}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 cursor-pointer',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500',
        checked ? 'bg-zinc-950 dark:bg-white' : 'bg-zinc-200 dark:bg-zinc-700',
        disabled && 'opacity-40 cursor-not-allowed',
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full shadow transition-all duration-200',
          checked ? 'left-6 bg-white dark:bg-zinc-950' : 'left-1 bg-white dark:bg-zinc-300'
        )}
      />
    </button>
  )
}

export function PrimaryButton({ children, className, disabled, onClick, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        triggerHaptic('light')
        onClick?.(e)
      }}
      className={cn(
        'w-full rounded-2xl bg-[#0c0c0e] hover:bg-zinc-900 text-white dark:bg-white dark:hover:bg-zinc-100 dark:text-[#0c0c0e] font-bold py-3.5 text-[15px] transition-all shadow-md shadow-black/15 active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function SecondaryButton({ children, className, onClick, ...props }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        triggerHaptic('light')
        onClick?.(e)
      }}
      className={cn('w-full rounded-2xl bg-white dark:bg-[#121214] border border-border/80 text-foreground hover:bg-muted/40 font-semibold py-3.5 text-[15px] transition-all active:scale-[0.98]', className)}
      {...props}
    >
      {children}
    </button>
  )
}

export function Card({ children, className, onClick }) {
  return (
    <div onClick={onClick} className={cn('rounded-2xl bg-white dark:bg-[#121214] border border-border/60 shadow-xs', onClick && 'cursor-pointer active:scale-[0.99] transition-transform', className)}>
      {children}
    </div>
  )
}

export function Field({ label, children, className }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      {children}
    </div>
  )
}

export function formatDateLabel(val, placeholder = 'Pilih Tanggal') {
  if (!val) return placeholder
  try {
    const raw = String(val).split('T')[0]
    const parts = raw.split('-').map(Number)
    if (parts.length === 3 && !parts.some(isNaN)) {
      const [y, m, d] = parts
      const dateObj = new Date(y, m - 1, d)
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      }
    }
    return val
  } catch {
    return val
  }
}

export function DatePickerInput({
  value,
  onChange,
  label,
  className,
  disabled = false,
  placeholder = 'Pilih Tanggal',
  min,
  max,
  clearable = false,
  onClear,
  id,
  'data-testid': dataTestId,
}) {
  const displayDate = useMemo(() => {
    return formatDateLabel(value, placeholder)
  }, [value, placeholder])

  return (
    <div className={cn('space-y-1.5 w-full', className)}>
      {label && (
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
          {label}
        </label>
      )}
      <div className="relative w-full">
        {/* Invisible native input date yang mengisi seluruh area kotak */}
        <input
          id={id}
          type="date"
          value={value ? String(value).split('T')[0] : ''}
          onChange={(e) => onChange?.(e.target.value)}
          onClick={(e) => {
            try {
              if (typeof e.target.showPicker === 'function') e.target.showPicker()
            } catch (_) {}
          }}
          disabled={disabled}
          min={min}
          max={max}
          data-testid={dataTestId}
          className="text-base absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed [color-scheme:light] dark:[color-scheme:dark]"
        />
        {/* Tampilan Visual Rata Kiri Konsisten */}
        <div
          className={cn(
            'w-full h-12 rounded-2xl bg-[#F6F6F6] dark:bg-[#18181b] border border-border/70 dark:border-white/10 px-4 flex items-center gap-2.5 transition-all active:scale-[0.99]',
            disabled && 'opacity-50 pointer-events-none'
          )}
        >
          <Calendar className="text-muted-foreground shrink-0" size={16} />
          <span
            className={cn(
              'text-sm font-semibold truncate flex-1 text-left',
              value ? 'text-foreground' : 'text-muted-foreground/60 font-medium'
            )}
          >
            {displayDate}
          </span>
          {clearable && value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                if (onClear) onClear()
                else onChange?.('')
              }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground p-1 z-20 shrink-0 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function TextInput({ className, type, ...props }) {
  if (type === 'date' || type === 'datetime-local') {
    const display = formatDateLabel(props.value, props.placeholder || 'Pilih tanggal')
    return (
      <div
        className={cn(
          'relative w-full h-12 rounded-2xl bg-[#F6F6F6] dark:bg-[#18181b] border border-border/70 dark:border-white/10 text-sm font-semibold text-foreground px-4 flex items-center gap-2.5 transition-all focus-within:ring-2 focus-within:ring-foreground/15 focus-within:border-foreground active:scale-[0.99]',
          props.disabled && 'opacity-50 pointer-events-none',
          className
        )}
      >
        <Calendar size={16} className="text-muted-foreground shrink-0 pointer-events-none" />
        <span
          className={cn(
            'text-sm font-semibold truncate flex-1 text-left pointer-events-none',
            props.value ? 'text-foreground' : 'text-muted-foreground/60 font-medium'
          )}
        >
          {display}
        </span>
        <input
          type={type}
          onClick={(e) => {
            try {
              if (typeof e.target.showPicker === 'function') e.target.showPicker()
            } catch (_) {}
          }}
          className="text-base opacity-0 absolute inset-0 w-full h-full cursor-pointer z-10 disabled:cursor-not-allowed [color-scheme:light] dark:[color-scheme:dark]"
          {...props}
        />
      </div>
    )
  }
  return (
    <input
      type={type}
      className={cn('w-full rounded-2xl bg-[#F6F6F6] dark:bg-[#121214] border border-border/70 text-foreground placeholder:text-muted-foreground/60 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-foreground/15 focus:border-foreground transition-all', className)}
      {...props}
    />
  )
}

export function DateSelector({
  value,
  onChange,
  displayValue,
  placeholder = 'Pilih tanggal',
  type = 'date',
  className,
  clearable = false,
  onClear,
  disabled = false,
  ...props
}) {
  return (
    <div
      className={cn(
        'relative w-full h-12 rounded-2xl bg-[#F6F6F6] dark:bg-[#18181b] border border-border/70 dark:border-white/10 text-sm font-semibold text-foreground px-4 flex items-center gap-2.5 cursor-pointer transition-all hover:bg-muted/20 focus-within:ring-2 focus-within:ring-foreground/15 focus-within:border-foreground',
        disabled && 'opacity-50 pointer-events-none',
        className
      )}
    >
      <Calendar size={16} className="text-muted-foreground shrink-0 pointer-events-none" />
      <span
        className={cn(
          'text-sm font-semibold truncate flex-1 text-left',
          value ? 'text-foreground' : 'text-muted-foreground/60 font-medium'
        )}
      >
        {displayValue || value || placeholder}
      </span>
      {clearable && value && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClear?.()
          }}
          className="text-xs text-muted-foreground hover:text-foreground p-1 z-20 shrink-0 cursor-pointer"
        >
          Clear
        </button>
      )}
      <input
        type={type}
        value={value || ''}
        onChange={onChange}
        onClick={(e) => {
          try {
            if (typeof e.target.showPicker === 'function') e.target.showPicker()
          } catch (_) {}
        }}
        disabled={disabled}
        className="text-base opacity-0 absolute inset-0 cursor-pointer w-full h-full z-10 [color-scheme:light] dark:[color-scheme:dark]"
        {...props}
      />
    </div>
  )
}

export function Avatar({ profile, size = 'md', onClick, className }) {
  const name = profile?.full_name || ''
  const initial = (name.trim()[0] || 'U').toUpperCase()
  const dims = size === 'lg' ? 'h-24 w-24 text-3xl' : size === 'sm' ? 'h-8 w-8 text-xs' : 'h-11 w-11 text-base'
  return (
    <button type="button" onClick={onClick} className={cn('rounded-full overflow-hidden bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-bold flex items-center justify-center shrink-0', dims, className)}>
      {profile?.avatar_url ? <img src={profile.avatar_url} alt="avatar" className="h-full w-full object-cover" /> : initial}
    </button>
  )
}

export function CheckIcon({ active }) {
  return active ? <Check size={18} className="text-foreground" strokeWidth={2.5} /> : null
}

// Bottom sheet built on framer-motion (supports stacking, swipe-to-dismiss, standardized header)
let activeSheetCount = 0

function safeUnlockBody() {
  if (activeSheetCount <= 0) {
    activeSheetCount = 0
    document.body.style.removeProperty('overflow')
    document.body.style.removeProperty('pointer-events')
    document.body.style.removeProperty('position')
    document.body.style.removeProperty('touch-action')
    document.documentElement.style.removeProperty('overflow')
    document.documentElement.style.removeProperty('pointer-events')
    document.body.removeAttribute('data-arshif-sheet-open')
    try {
      window.dispatchEvent(new CustomEvent('arshif-sheet-toggle', { detail: { open: false } }))
    } catch {}
  }
}

export function Sheet({ open, onClose, children, title, left, right, full = false, className, zIndex = 70, noPadding = false }) {
  const app = useApp()
  const cancelText = app?.t ? app.t('cancel') : 'Cancel'
  const controls = useDragControls()

  useEffect(() => {
    if (!open) {
      safeUnlockBody()
      return
    }

    activeSheetCount++
    triggerHaptic('success')
    document.body.style.overflow = 'hidden'
    document.body.setAttribute('data-arshif-sheet-open', 'true')
    try {
      window.dispatchEvent(new CustomEvent('arshif-sheet-toggle', { detail: { open: true } }))
    } catch {}

    return () => {
      activeSheetCount = Math.max(0, activeSheetCount - 1)
      safeUnlockBody()
    }
  }, [open])

  const startDrag = (e) => { try { controls.start(e) } catch { /* ignore */ } }
  const onDragEnd = (_e, info) => { if ((info?.offset?.y || 0) > 90 || (info?.velocity?.y || 0) > 500) onClose?.() }

  return (
    <AnimatePresence onExitComplete={safeUnlockBody}>
      {open ? (
        <motion.div
          className={cn('fixed inset-0', !open && 'pointer-events-none')}
          style={{ zIndex }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          transition={{ duration: 0.18 }}
        >
          <div
            className={cn('absolute inset-0 bg-black/55 backdrop-blur-[2px]', !open && 'pointer-events-none')}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.8 }}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={onDragEnd}
            className={cn(
              'absolute inset-x-0 bottom-0 mx-auto w-full max-w-md bg-white dark:bg-[#121214] shadow-2xl flex flex-col overflow-hidden border-t sm:border border-border/50 transform-gpu will-change-transform',
              'rounded-t-3xl sm:rounded-3xl',
              // Dynamic viewport height constraint max-h-[78dvh] sm:max-h-[85dvh]
              'max-h-[78dvh] sm:max-h-[85dvh] sm:bottom-6',
              full && 'h-[78dvh] sm:h-[85dvh]',
              !open && 'pointer-events-none',
              className
            )}
          >
            {/* Drag handle + sticky header berkunci latar belakang solid */}
            <div className="shrink-0 bg-white dark:bg-[#121214] border-b border-border/40 z-20">
              <div onPointerDown={startDrag} className="w-10 h-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700 mx-auto my-3 cursor-grab active:cursor-grabbing touch-none" />
              <div className="flex items-center justify-between px-5 pb-3 min-h-[44px] gap-2">
                <div className="min-w-[72px] flex justify-start">
                  {left !== undefined ? left : (
                    <button
                      type="button"
                      onClick={(e) => {
                        triggerHaptic('light')
                        onClose?.(e)
                      }}
                      className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {cancelText}
                    </button>
                  )}
                </div>
                <h2 onPointerDown={startDrag} className="text-base font-bold text-foreground text-center flex-1 truncate cursor-grab active:cursor-grabbing">{title}</h2>
                <div className="min-w-[72px] flex justify-end">{right}</div>
              </div>
            </div>

            {/* Area scroll form dengan padding bawah cukup untuk bilah Safari */}
            <div className={cn('flex-1 min-h-0 overflow-y-auto overscroll-contain no-scrollbar safe-bottom touch-pan-y', noPadding ? '' : 'px-5 pt-3 pb-24 sm:pb-8')}>{children}</div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

export function SheetTextButton({ children, onClick, bold, muted, className, ...props }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        triggerHaptic('light')
        onClick?.(e)
      }}
      className={cn(
        'text-[15px] py-1 transition-colors cursor-pointer',
        bold && 'font-bold text-foreground hover:opacity-80',
        muted && 'font-medium text-muted-foreground hover:text-foreground',
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function IconButton({ children, onClick, className, ...props }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        triggerHaptic('light')
        onClick?.(e)
      }}
      className={cn('h-10 w-10 rounded-full flex items-center justify-center bg-white dark:bg-[#121214] border border-border/70 text-foreground shadow-xs active:scale-95 transition cursor-pointer', className)}
      {...props}
    >
      {children}
    </button>
  )
}

export function CloseButton({ onClick }) {
  return (
    <IconButton onClick={onClick} aria-label="close">
      <X size={18} />
    </IconButton>
  )
}

// Local React Error Boundary - prevents a single bad tab from crashing the whole app.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.warn('ErrorBoundary caught:', error?.message, info?.componentStack)
  }
  render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') return this.props.fallback(() => this.setState({ hasError: false }))
      return this.props.fallback ?? null
    }
    return this.props.children
  }
}

export function EmptyState({ icon: Icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="h-16 w-16 rounded-2xl bg-white dark:bg-[#121214] border border-border/60 shadow-xs flex items-center justify-center mb-4">{Icon ? <Icon size={26} className="text-foreground" /> : null}</div>
      <p className="font-bold text-foreground">{title}</p>
      {subtitle ? <p className="text-sm text-muted-foreground mt-1 max-w-[240px]">{subtitle}</p> : null}
    </div>
  )
}

export { DotsLoader, DotsLoadingScreen, DotsButtonLoader } from './DotsLoader'
