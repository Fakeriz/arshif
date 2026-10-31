'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Bell,
  Calendar,
  Clock,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  X,
  Megaphone,
} from 'lucide-react'
import { useApp } from './context'
import { Sheet, EmptyState } from './ui'
import { deriveNotifications } from '@/lib/notifications'
import { supabase } from '@/lib/supabase'
import { cn, triggerHaptic } from '@/lib/utils'

function formatAnnouncementDate(dateStr) {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

export default function NotificationsSheet({ open, onClose }) {
  const {
    t,
    open: openSheet,
    setTab,
    bills: ctxBills = [],
    budgets: ctxBudgets = [],
    goals = [],
    transactions = [],
    home = 'USD',
    rates = {},
    fmt,
    store,
  } = useApp()

  const [localBills, setLocalBills] = useState([])
  const [localBudgets, setLocalBudgets] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [dismissedIds, setDismissedIds] = useState([])

  // Fetch public announcements from Supabase
  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
      if (!error && Array.isArray(data)) {
        setAnnouncements(data)
      }
    } catch (err) {
      console.warn('fetchAnnouncements error:', err)
    }
  }

  // Refresh bills, budgets & announcements on sheet open
  useEffect(() => {
    if (!open) return
    let active = true

    const loadLive = async () => {
      try {
        const [b, bg] = await Promise.all([
          store?.listBills ? store.listBills() : Promise.resolve([]),
          store?.listBudgets ? store.listBudgets() : Promise.resolve([]),
        ])
        if (active) {
          if (Array.isArray(b)) setLocalBills(b)
          if (Array.isArray(bg)) setLocalBudgets(bg)
        }
      } catch (err) {
        console.warn('NotificationsSheet live load error:', err)
      }

      if (active) {
        await fetchAnnouncements()
      }
    }

    loadLive()
    return () => {
      active = false
    }
  }, [open, store])

  // Mark announcements as read in localStorage when opened
  useEffect(() => {
    if (open && announcements.length > 0) {
      try {
        const stored = JSON.parse(localStorage.getItem('read_announcements') || '[]')
        const allIds = Array.from(new Set([...stored, ...announcements.map((a) => a.id)]))
        localStorage.setItem('read_announcements', JSON.stringify(allIds))
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('read_announcements_updated'))
        }
      } catch (e) {
        console.warn('mark announcements as read error:', e)
      }
    }
  }, [open, announcements])

  const effectiveBills = localBills.length > 0 ? localBills : ctxBills
  const effectiveBudgets = localBudgets.length > 0 ? localBudgets : ctxBudgets

  // Derived local notifications (upcoming/overdue bills & budget warnings)
  const { notifications, hasUrgent } = useMemo(() => {
    return deriveNotifications({
      bills: effectiveBills,
      budgets: effectiveBudgets,
      goals,
      transactions,
      home,
      rates,
      fmt,
      t,
    })
  }, [effectiveBills, effectiveBudgets, goals, transactions, home, rates, fmt, t])

  // Public admin announcements formatted as notification items
  const announcementItems = useMemo(() => {
    return (announcements || []).map((a) => ({
      id: `announcement-${a.id}`,
      originalId: a.id,
      type: 'announcement',
      isUrgent: false,
      isAnnouncement: true,
      iconType: 'megaphone',
      title: a.title || 'Pengumuman',
      description: a.content || a.message || a.description || '',
      date: formatAnnouncementDate(a.created_at),
      action: null,
      meta: a,
    }))
  }, [announcements])

  // Urgent notifications first, then announcements, then the static welcome.
  const combinedNotifications = useMemo(() => {
    const urgentItems = notifications.filter((n) => n.isUrgent)
    const hasAnyContent = urgentItems.length > 0 || announcementItems.length > 0

    if (hasAnyContent) {
      return [...urgentItems, ...announcementItems]
    }

    // If no urgent bills/budgets and no announcements, show static welcome
    const welcomeItems = notifications.filter((n) => n.type === 'welcome')
    return welcomeItems.length > 0 ? welcomeItems : []
  }, [notifications, announcementItems])

  const visibleNotifications = useMemo(() => {
    return combinedNotifications.filter((n) => !dismissedIds.includes(n.id))
  }, [combinedNotifications, dismissedIds])

  const handleNotificationClick = (n) => {
    if (!n.action) return
    triggerHaptic('light')
    onClose?.()
    if (n.action === 'bills') {
      setTimeout(() => {
        openSheet?.('bills')
      }, 150)
    } else if (n.action === 'goals') {
      setTimeout(() => {
        setTab?.('goals')
      }, 150)
    }
  }

  const dismissNotification = (e, id) => {
    e.stopPropagation()
    triggerHaptic('light')
    setDismissedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  const clearAllNotifications = () => {
    triggerHaptic('warning')
    setDismissedIds(combinedNotifications.map((n) => n.id))
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('notifications')}
      right={
        visibleNotifications.length > 0 ? (
          <button
            type="button"
            onClick={clearAllNotifications}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Bersihkan
          </button>
        ) : null
      }
    >
      <div className="pt-2 pb-6">
        {visibleNotifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t('no_notifications')}
            subtitle={t('no_notifications')}
          />
        ) : (
          <div className="space-y-2.5">
            {visibleNotifications.map((n) => {
              const isClickable = Boolean(n.action)

              return (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={(e) => {
                    if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                      handleNotificationClick(n)
                    }
                  }}
                  className={cn(
                    'bg-muted/30 border border-border/40 rounded-2xl p-4 flex gap-3.5 mb-2.5 text-left transition-all relative group',
                    isClickable
                      ? 'cursor-pointer hover:bg-muted/50 active:scale-[0.985]'
                      : 'select-none'
                  )}
                >
                  {/* Icon container */}
                  <div
                    className={cn(
                      'h-10 w-10 rounded-xl shrink-0 flex items-center justify-center border',
                      n.type === 'announcement'
                        ? 'bg-[#6A92FC]/10 border-[#6A92FC]/20 text-[#6A92FC]'
                        : n.type === 'budget'
                        ? 'bg-amber-500/10 border-amber-500/20 text-amber-500'
                        : n.isOverdue
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                        : 'bg-white dark:bg-[#121214] border-border/60 text-foreground'
                    )}
                  >
                    {n.iconType === 'megaphone' && (
                      <Megaphone size={18} strokeWidth={1.75} className="text-[#6A92FC]" />
                    )}
                    {n.iconType === 'alert-triangle' && (
                      <AlertTriangle size={18} className="text-amber-500" strokeWidth={1.75} />
                    )}
                    {n.iconType === 'clock' && (
                      <Clock
                        size={18}
                        className={n.isOverdue ? 'text-rose-500' : 'text-foreground'}
                        strokeWidth={1.75}
                      />
                    )}
                    {n.iconType === 'calendar' && (
                      <Calendar size={18} className="text-foreground" strokeWidth={1.75} />
                    )}
                    {n.iconType === 'sparkles' && (
                      <Sparkles size={18} className="text-[#6A92FC]" strokeWidth={1.75} />
                    )}
                  </div>

                  {/* Body text */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <p className="text-sm font-bold text-foreground truncate">
                        {n.title}
                      </p>
                      {n.type === 'announcement' && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 tracking-wide bg-[#6A92FC]/10 text-[#6A92FC] border border-[#6A92FC]/20">
                          Pengumuman
                        </span>
                      )}
                      {n.isUrgent && (
                        <span
                          className={cn(
                            'text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 tracking-wide',
                            n.isOverdue
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : n.type === 'budget'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-muted text-muted-foreground border border-border/40'
                          )}
                        >
                          {n.isOverdue
                            ? t('notif_overdue_badge')
                            : n.type === 'budget'
                            ? t('notif_budget_badge')
                            : t('notif_due_soon_badge')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {n.description}
                    </p>

                    {n.date && (
                      <p className="text-[10px] text-muted-foreground/75 mt-1.5 tabular-nums font-medium">
                        {n.date}
                      </p>
                    )}

                    {isClickable && (
                      <div className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold text-foreground group-hover:underline">
                        <span>{n.action === 'bills' ? 'Buka Tagihan' : 'Buka Tab Goals'}</span>
                        <ChevronRight size={13} strokeWidth={2} />
                      </div>
                    )}
                  </div>

                  {/* Dismiss button */}
                  <button
                    type="button"
                    onClick={(e) => dismissNotification(e, n.id)}
                    className="absolute top-3.5 right-3.5 h-6 w-6 rounded-lg text-muted-foreground hover:text-foreground flex items-center justify-center hover:bg-muted/50 transition-colors"
                    aria-label="Tutup notifikasi"
                  >
                    <X size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Sheet>
  )
}
