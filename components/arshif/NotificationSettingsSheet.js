'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, BellOff, CalendarClock, Wallet, Megaphone, Send, Loader2, Smartphone, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, SectionLabel } from './ui'
import { cn } from '@/lib/utils'
import {
  isPushSupported,
  getPermissionState,
  enablePush,
  disablePush,
  getPushSettings,
  updatePushSettings,
  sendTestPush,
  getCachedPushSettings,
} from '@/lib/push'

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange?.(!checked) }}
      className={cn(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-zinc-950 dark:bg-white' : 'bg-zinc-200 dark:bg-zinc-700',
        disabled && 'opacity-40'
      )}
    >
      <span
        className={cn(
          'absolute top-1 h-5 w-5 rounded-full bg-white dark:bg-zinc-950 shadow transition-all duration-200',
          checked ? 'left-6' : 'left-1',
          // Kontras knob saat aktif di dark mode
          checked && 'dark:bg-zinc-950',
          !checked && 'dark:bg-zinc-300'
        )}
        style={checked ? { background: '#fff' } : undefined}
      />
    </button>
  )
}

function SettingRow({ icon: Icon, title, desc, checked, onChange, disabled }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center shrink-0">
        <Icon size={17} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[15px] text-zinc-950 dark:text-white">{title}</p>
        {desc ? <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{desc}</p> : null}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  )
}

export default function NotificationSettingsSheet({ open, onClose }) {
  const { t } = useApp()
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [supported] = useState(() => isPushSupported())
  const [permission, setPermission] = useState(() => getPermissionState())
  
  // Baca cache awal seketika (0ms render time)
  const [devices, setDevices] = useState(() => {
    const cached = getCachedPushSettings()
    return cached?.devices || 0
  })
  const [settings, setSettings] = useState(() => {
    const cached = getCachedPushSettings()
    return cached?.settings || {
      push_enabled: false,
      bill_enabled: true,
      budget_enabled: true,
      announcement_enabled: true,
    }
  })

  // Periksa ulang izin secara instan saat window kembali aktif/fokus (misal user balik dari Settings HP)
  const refreshPermission = useCallback(() => {
    const state = getPermissionState()
    setPermission(state)
    return state
  }, [])

  useEffect(() => {
    if (!open) return
    refreshPermission()
    const onFocus = () => refreshPermission()
    window.addEventListener('focus', onFocus)
    window.addEventListener('visibilitychange', onFocus)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('visibilitychange', onFocus)
    }
  }, [open, refreshPermission])

  // Muat data server di latar belakang secara mulus (silent sync, tanpa blocking spinner)
  useEffect(() => {
    if (!open) return
    let active = true
    setIsSyncing(true)
    ;(async () => {
      try {
        const data = await getPushSettings()
        if (active && data?.settings) {
          setSettings(data.settings)
          setDevices(data.devices || 0)
        }
      } catch (e) {
        console.warn('load push settings background:', e?.message)
      } finally {
        if (active) setIsSyncing(false)
      }
    })()
    return () => { active = false }
  }, [open])

  const handleMasterToggle = async (next) => {
    if (saving) return
    setSaving(true)
    try {
      if (next) {
        await enablePush()
        setSettings((s) => ({ ...s, push_enabled: true }))
        setPermission('granted')
        const data = await getPushSettings().catch(() => null)
        if (data) setDevices(data.devices || 0)
        toast.success(t('push_enabled_toast'))
      } else {
        await disablePush()
        setSettings((s) => ({ ...s, push_enabled: false }))
        toast.success(t('push_disabled_toast'))
      }
    } catch (e) {
      toast.error(e?.message || t('push_settings_error'))
      refreshPermission()
    } finally {
      setSaving(false)
    }
  }

  const handleTypeToggle = async (key, next) => {
    if (saving) return
    const prev = settings[key]
    setSettings((s) => ({ ...s, [key]: next }))
    try {
      await updatePushSettings({ [key]: next })
    } catch (e) {
      setSettings((s) => ({ ...s, [key]: prev }))
      toast.error(e?.message || t('push_save_error'))
    }
  }

  const handleTest = async () => {
    if (testing) return
    setTesting(true)
    try {
      const res = await sendTestPush()
      if (res?.sent > 0) {
        toast.success(t('push_test_sent'))
      } else {
        toast.error(t('push_test_failed', { error: res?.lastError || t('push_test_no_device') }))
      }
    } catch (e) {
      toast.error(e?.message || t('push_test_error'))
    } finally {
      setTesting(false)
    }
  }

  const pushOn = settings.push_enabled && permission === 'granted'
  const box = 'rounded-2xl divide-y divide-zinc-200 dark:divide-white/10 border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121214] overflow-hidden'

  return (
    <Sheet open={open} onClose={onClose} full zIndex={80} title={t('notifications')}>
      <div className="pt-1 space-y-5 pb-6">
        {!supported ? (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-4 flex gap-3">
            <BellOff size={18} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t('push_not_supported')}
            </p>
          </div>
        ) : null}

        {permission === 'denied' ? (
          <div className="rounded-2xl border border-red-200/80 dark:border-red-900/50 bg-red-50/90 dark:bg-red-950/30 p-4 space-y-2.5">
            <div className="flex gap-3">
              <BellOff size={18} className="shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-200 leading-snug">
                {t('push_permission_denied')} <b>{t('push_permission_denied_path')}</b>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const p = refreshPermission()
                if (p === 'granted') {
                  toast.success(t('push_permission_granted'))
                } else if (p === 'denied') {
                  toast.error(t('push_permission_still_blocked'))
                } else {
                  toast.info(t('push_permission_status', { status: p }))
                }
              }}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-xl bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 active:scale-[0.98] transition"
            >
              <RefreshCw size={13} />
              {t('push_recheck_permission')}
            </button>
          </div>
        ) : null}

        {/* Master Push Toggle (Langsung tampil instan tanpa loading) */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-1">
            <SectionLabel className="!mb-0">{t('push_notification')}</SectionLabel>
            {isSyncing ? (
              <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" />
                {t('push_syncing')}
              </span>
            ) : null}
          </div>
          <div className={box}>
            <SettingRow
              icon={pushOn ? Bell : BellOff}
              title={t('push_device_notifications')}
              desc={
                permission === 'denied'
                  ? t('push_permission_blocked_system')
                  : pushOn
                  ? t('push_active_devices', { count: devices })
                  : t('push_enable_hint')
              }
              checked={pushOn}
              onChange={handleMasterToggle}
              disabled={!supported || saving || permission === 'denied'}
            />
          </div>
          {pushOn && devices > 0 ? (
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#121214] px-4 py-3 text-sm font-semibold text-zinc-900 dark:text-white active:scale-[0.98] transition disabled:opacity-50"
            >
              {testing ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {testing ? t('push_sending') : t('push_send_test')}
            </button>
          ) : null}
        </div>

        {/* Jenis Notifikasi */}
        <div className={cn(!pushOn && 'opacity-40 pointer-events-none')}>
          <SectionLabel>{t('notification_types')}</SectionLabel>
          <div className={box}>
            <SettingRow
              icon={CalendarClock}
              title={t('push_bill_title')}
              desc={t('push_bill_desc')}
              checked={settings.bill_enabled}
              onChange={(v) => handleTypeToggle('bill_enabled', v)}
              disabled={!pushOn}
            />
            <SettingRow
              icon={Wallet}
              title={t('push_budget_title')}
              desc={t('push_budget_desc')}
              checked={settings.budget_enabled}
              onChange={(v) => handleTypeToggle('budget_enabled', v)}
              disabled={!pushOn}
            />
            <SettingRow
              icon={Megaphone}
              title={t('push_announcement_title')}
              desc={t('push_announcement_desc')}
              checked={settings.announcement_enabled}
              onChange={(v) => handleTypeToggle('announcement_enabled', v)}
              disabled={!pushOn}
            />
          </div>
          {!pushOn ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 px-1 flex items-center gap-1.5">
              <Smartphone size={13} />
              {t('push_enable_first_hint')}
            </p>
          ) : null}
        </div>

        <p className="text-xs text-zinc-400 dark:text-zinc-500 px-1 leading-relaxed">
          {t('push_footer_note')}
        </p>
      </div>
    </Sheet>
  )
}
