'use client'
import { useState } from 'react'
import { Eye, EyeOff, Loader2, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { PrimaryButton, TextInput } from './ui'
import { supabase } from '@/lib/supabase'

// Shown when Supabase fires a PASSWORD_RECOVERY event (user clicked the reset email link).
// Lets the user set a brand-new password instead of dropping them straight onto Home.
export default function NewPasswordSheet({ onDone }) {
  const { t } = useApp()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e?.preventDefault?.()
    if (password.length < 6) { toast.error(t('password_too_short')); return }
    if (password !== confirm) { toast.error(t('passwords_no_match')); return }
    setBusy(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      toast.success(t('password_updated'))
      // Clear the recovery hash/token from the URL so refreshes don't re-trigger it.
      try {
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState(null, '', window.location.pathname)
        }
      } catch {}
      onDone?.()
    } catch (err) {
      toast.error(err?.message || t('error'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-dvh bg-background max-w-md mx-auto flex flex-col px-6 safe-top">
      <div className="flex-1 flex flex-col justify-center py-10">
        <div className="mb-8">
          <div className="h-14 w-14 rounded-2xl bg-foreground text-background flex items-center justify-center mb-6">
            <KeyRound size={24} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t('set_new_password')}</h1>
          <p className="text-muted-foreground mt-2">{t('set_new_password_sub')}</p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="relative">
            <TextInput type={show ? 'text' : 'password'} autoComplete="new-password" placeholder={t('new_password')} value={password} onChange={(e) => setPassword(e.target.value)} className="pr-12" data-testid="new-password" />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground p-1" aria-label="toggle password">
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <TextInput type={show ? 'text' : 'password'} autoComplete="new-password" placeholder={t('confirm_password')} value={confirm} onChange={(e) => setConfirm(e.target.value)} data-testid="confirm-password" />
          <PrimaryButton type="submit" disabled={busy || !password || !confirm} data-testid="update-password-submit">
            {busy ? <Loader2 className="animate-spin inline" size={18} /> : t('update_password')}
          </PrimaryButton>
        </form>
      </div>
    </div>
  )
}
