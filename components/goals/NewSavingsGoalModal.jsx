'use client'
import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Camera,
  Trash2,
  Calendar,
  Flag,
  Home,
  Plane,
  Car,
  Smartphone,
  Gem,
  GraduationCap,
  Banknote,
  Umbrella,
  ShoppingCart,
  Laptop,
  Gamepad2,
  Image as ImageIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { getCurrency } from '@/lib/currencies'
import { cn, triggerHaptic } from '@/lib/utils'
import { Sheet, DatePickerInput } from '@/components/arshif/ui'

// 12 Lucide icons arranged in 2 rows x 6 columns
export const SAVINGS_GOAL_ICONS = [
  // Row 1
  { id: 'flag', Icon: Flag, label: 'Flag' },
  { id: 'home', Icon: Home, label: 'Home' },
  { id: 'plane', Icon: Plane, label: 'Plane' },
  { id: 'car', Icon: Car, label: 'Car' },
  { id: 'smartphone', Icon: Smartphone, label: 'Phone' },
  { id: 'gem', Icon: Gem, label: 'Special' },
  // Row 2
  { id: 'graduation_cap', Icon: GraduationCap, label: 'Education' },
  { id: 'banknote', Icon: Banknote, label: 'Money' },
  { id: 'umbrella', Icon: Umbrella, label: 'Protection' },
  { id: 'shopping_cart', Icon: ShoppingCart, label: 'Shopping' },
  { id: 'laptop', Icon: Laptop, label: 'Tech' },
  { id: 'gamepad_2', Icon: Gamepad2, label: 'Gaming' },
]

export const resolveSavingsGoalIcon = (id) => {
  const match = SAVINGS_GOAL_ICONS.find((item) => item.id === id)
  if (match) return match.Icon

  // Backward compatibility with legacy IDs
  const legacyMap = {
    target: Flag,
    travel: Plane,
    wedding: Gem,
    education: GraduationCap,
    gadget: Smartphone,
    invest: Banknote,
    love: Gem,
    gift: ShoppingCart,
    sparkles: Gem,
  }
  return legacyMap[id] || Flag
}

export default function NewSavingsGoalModal({
  open,
  onClose,
  onSaved,
  home = 'IDR',
  store,
  t = (k) => k,
}) {
  const [goalName, setGoalName] = useState('')
  const [targetAmount, setTargetAmount] = useState('')
  const [startingBalance, setStartingBalance] = useState('')
  const [selectedIcon, setSelectedIcon] = useState('flag')
  const [deadline, setDeadline] = useState('')
  const [monthlyTarget, setMonthlyTarget] = useState('')
  const [coverPhoto, setCoverPhoto] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fileInputRef = useRef(null)

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return
    setGoalName('')
    setTargetAmount('')
    setStartingBalance('')
    setSelectedIcon('flag')
    setDeadline('')
    setMonthlyTarget('')
    setCoverPhoto('')
    setIsDragging(false)
    setIsSubmitting(false)
  }, [open])

  // Prevent background scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const currencySymbol = useMemo(() => {
    return getCurrency(home)?.symbol || home || '$'
  }, [home])

  // Amount sanitization: allow digits and single dot/comma
  const handleAmountChange = (e, setter) => {
    const raw = e.target.value.replace(/,/g, '.').replace(/[^0-9.]/g, '')
    if ((raw.match(/\./g) || []).length > 1) return
    setter(raw)
  }

  // Auto-calculate monthly target when deadline, target, or starting balance updates
  const calculateMonthlyTarget = (deadlineVal, targetVal, startingVal) => {
    if (!deadlineVal || !targetVal) return
    const targetNum = Number(targetVal) || 0
    const startNum = Number(startingVal) || 0
    const needed = Math.max(0, targetNum - startNum)
    if (needed <= 0) {
      setMonthlyTarget('0')
      return
    }
    const deadDate = new Date(deadlineVal)
    const curDate = new Date()
    const months = Math.max(
      1,
      (deadDate.getFullYear() - curDate.getFullYear()) * 12 +
        (deadDate.getMonth() - curDate.getMonth())
    )
    setMonthlyTarget(String(Math.round(needed / months)))
  }

  // Cover photo file processor (supports click and drag-drop)
  const processImageFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('File harus berupa gambar')
      return
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('Ukuran maksimal foto 3MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => {
      setCoverPhoto(event.target?.result || '')
    }
    reader.readAsDataURL(file)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    processImageFile(file)
    // Clear value to allow selecting same file again
    e.target.value = ''
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    processImageFile(file)
  }

  const targetNum = Number(targetAmount) || 0
  const isValid = goalName.trim().length > 0 && targetNum > 0

  const handleCreateGoal = async () => {
    const trimmedName = goalName.trim()
    if (!trimmedName) {
      toast.error('Masukkan nama target tabungan')
      return
    }
    if (!targetNum || targetNum <= 0) {
      toast.error('Masukkan nominal target yang valid')
      return
    }

    setIsSubmitting(true)
    try {
      const payload = {
        name: trimmedName,
        type: 'saving',
        icon: selectedIcon,
        target_amount: targetNum,
        saved_amount: Number(startingBalance) || 0,
        currency: home,
        deadline: deadline || null,
        monthly_target: Number(monthlyTarget) || null,
        cover_url: coverPhoto || null,
      }

      if (store?.createGoal) {
        await store.createGoal(payload)
      }

      triggerHaptic('success')
      toast.success(t?.('saved_msg') || 'Target tabungan berhasil dibuat')
      onSaved?.()
      onClose?.()
    } catch (err) {
      // If error occurs due to extra schema column rejection, retry with core fields
      if (store?.createGoal && (/column/i.test(err?.message || '') || err?.code === '42703')) {
        try {
          await store.createGoal({
            name: trimmedName,
            icon: selectedIcon,
            target_amount: targetNum,
            saved_amount: Number(startingBalance) || 0,
            currency: home,
            deadline: deadline || null,
          })
          triggerHaptic('success')
          toast.success(t?.('saved_msg') || 'Target tabungan berhasil dibuat')
          onSaved?.()
          onClose?.()
          return
        } catch {
          // continue to toast below
        }
      }
      toast.error(err?.message || t?.('error') || 'Gagal menyimpan target')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Format deadline date for readable presentation
  const formattedDeadlineDisplay = useMemo(() => {
    if (!deadline) return 'No deadline'
    try {
      const d = new Date(deadline + 'T00:00:00')
      return d.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    } catch {
      return deadline
    }
  }, [deadline])

  return (
    <Sheet
      open={open}
      onClose={onClose}
      zIndex={70}
      title={t('savings_goal_new')}
      left={
        <button
          type="button"
          onClick={onClose}
          className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          Cancel
        </button>
      }
    >
      <div className="space-y-4">
        {/* Cover photo (opsional) */}
              <div>
                <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-2 block">
                  COVER PHOTO (OPTIONAL)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    'relative rounded-2xl bg-muted/30 border border-dashed border-border/60 p-8 flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden group min-h-[130px]',
                    isDragging ? 'bg-muted/60 border-foreground/50' : 'hover:bg-muted/50'
                  )}
                >
                  {coverPhoto ? (
                    <>
                      <img
                        src={coverPhoto}
                        alt="Cover Preview"
                        className="w-full h-full object-cover absolute inset-0"
                      />
                      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            fileInputRef.current?.click()
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white text-xs font-semibold backdrop-blur-sm transition-all"
                        >
                          Change photo
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setCoverPhoto('')
                          }}
                          className="p-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-all"
                          title={t('remove_cover') || 'Hapus foto'}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center gap-1.5 pointer-events-none">
                      <div className="w-10 h-10 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:scale-105 transition-all">
                        <Camera size={20} strokeWidth={1.75} />
                      </div>
                      <span className="text-xs font-medium text-muted-foreground mt-0.5">
                        Add a photo
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Icon selector */}
              <div>
                <label className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase mb-2 block">
                  ICON
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {SAVINGS_GOAL_ICONS.map(({ id, Icon, label }) => {
                    const isSelected = selectedIcon === id
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelectedIcon(id)}
                        className={cn(
                          'w-11 h-11 rounded-2xl flex items-center justify-center transition-all cursor-pointer mx-auto',
                          isSelected
                            ? 'bg-foreground text-background shadow-xs'
                            : 'bg-muted/40 border border-border/30 text-muted-foreground hover:text-foreground'
                        )}
                        aria-label={label}
                        title={label}
                      >
                        <Icon size={18} strokeWidth={isSelected ? 2 : 1.75} />
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Form inputs */}
                            <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">
                  Goal name
                </label>
                <input
                  type="text"
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  placeholder="e.g. New iPhone, Holiday trip..."
                  className="w-full bg-muted/40 rounded-2xl p-4 text-sm font-medium text-foreground outline-none border border-border/30 placeholder:text-muted-foreground/40 focus:border-foreground/40 transition-colors"
                />
              </div>

                            <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">
                  Target amount
                </label>
                <div className="relative rounded-2xl bg-muted/40 border border-border/30 p-3.5 flex items-center gap-2 focus-within:border-foreground/40 transition-colors">
                  <span className="text-base font-bold text-foreground select-none shrink-0 pl-1">
                    {currencySymbol}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={targetAmount}
                    onChange={(e) => {
                      handleAmountChange(e, setTargetAmount)
                      calculateMonthlyTarget(deadline, e.target.value, startingBalance)
                    }}
                    placeholder="0.00"
                    className="w-full text-base font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/30 tabular-nums"
                  />
                </div>
              </div>

                            <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">
                  Starting saved balance
                </label>
                <div className="relative rounded-2xl bg-muted/40 border border-border/30 p-3.5 flex items-center gap-2 focus-within:border-foreground/40 transition-colors">
                  <span className="text-base font-bold text-foreground select-none shrink-0 pl-1">
                    {currencySymbol}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={startingBalance}
                    onChange={(e) => {
                      handleAmountChange(e, setStartingBalance)
                      calculateMonthlyTarget(deadline, targetAmount, e.target.value)
                    }}
                    placeholder="0.00"
                    className="w-full text-base font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/30 tabular-nums"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 px-1">
                  Opening balance isn't counted as money saved this month.
                </p>
              </div>

                            <DatePickerInput
                label="Deadline (optional)"
                value={deadline}
                onChange={(val) => {
                  setDeadline(val)
                  calculateMonthlyTarget(val, targetAmount, startingBalance)
                }}
                clearable
                onClear={() => {
                  setDeadline('')
                  setMonthlyTarget('')
                }}
              />

                            <div>
                <label className="text-xs text-muted-foreground font-medium mb-1 block">
                  Monthly savings target (optional)
                </label>
                <div className="relative rounded-2xl bg-muted/40 border border-border/30 p-3.5 flex items-center gap-2 focus-within:border-foreground/40 transition-colors">
                  <span className="text-base font-bold text-foreground select-none shrink-0 pl-1">
                    {currencySymbol}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={monthlyTarget}
                    onChange={(e) => handleAmountChange(e, setMonthlyTarget)}
                    placeholder="0.00"
                    className="w-full text-base font-bold text-foreground bg-transparent outline-none placeholder:text-muted-foreground/30 tabular-nums"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 px-1">
                  How much you aim to put toward this goal each month.
                </p>
              </div>

              {/* Tombol buat goal */}
              <button
                type="button"
                onClick={handleCreateGoal}
                disabled={!isValid || isSubmitting}
                className="w-full bg-foreground text-background font-bold py-4 rounded-2xl shadow-lg hover:opacity-90 active:scale-[0.99] transition-all text-sm mt-5 mb-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Goal'}
              </button>
            </div>
    </Sheet>
  )
}
