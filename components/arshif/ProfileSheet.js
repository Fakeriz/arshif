'use client'
import { useEffect, useRef, useState } from 'react'
import { Camera, Building2, ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, SheetTextButton, Field, TextInput, Segmented, PrimaryButton } from './ui'
import { fileToDataUrl } from '@/lib/ledger'
import { getCurrency } from '@/lib/currencies'
import { cn } from '@/lib/utils'
import { sanitizeAmount } from '@/lib/amount'

const ID_BANKS = ['BCA', 'Mandiri', 'BRI', 'BNI', 'BSI', 'CIMB Niaga', 'Permata', 'Danamon', 'Maybank', 'Jago', 'SeaBank', 'GoPay', 'OVO', 'DANA']
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } }
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} }

const EMPTY_BIZ = { logo: '', companyName: '', address: '', phone: '', email: '', bankName: '', accHolder: '', accNumber: '', legalName: '', npwp: '', nib: '', taxStatus: 'nonpkp', openingBalance: '' }

export default function ProfileSheet({ open, onClose }) {
  const { t, profile, updateProfile, session, isGuest, home } = useApp()
  const scope = session?.user?.id || 'guest'
  const BIZ_KEY = `arshif_bizprofile_${scope}`
  const CTX_KEY = 'arshif_bizctx'

  const [name, setName] = useState('')
  const [mode, setMode] = useState('personal')
  const [avatar, setAvatar] = useState('')
  const [ctx, setCtx] = useState('personal')
  const [biz, setBiz] = useState(EMPTY_BIZ)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef(null)
  const logoRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setName(profile?.full_name || '')
    setMode(profile?.usage_mode || 'personal')
    setAvatar(profile?.avatar_url || '')
    setBiz({ ...EMPTY_BIZ, ...(lsGet(BIZ_KEY, {}) || {}) })
    setCtx(lsGet(CTX_KEY, 'personal') || 'personal')
  }, [open, profile]) // eslint-disable-line

  const setB = (patch) => setBiz((b) => ({ ...b, ...patch }))

  const onAvatar = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    try { setAvatar(await fileToDataUrl(f, 256)) } catch { toast.error(t('error')) }
  }
  const onLogo = async (e) => {
    const f = e.target.files?.[0]; if (!f) return
    try { setB({ logo: await fileToDataUrl(f, 600) }) } catch { toast.error(t('error')) }
  }

  const save = async () => {
    setSaving(true)
    try {
      await updateProfile({ full_name: name, usage_mode: mode, avatar_url: avatar })
      lsSet(BIZ_KEY, biz)
      if (mode !== 'both') { lsSet(CTX_KEY, mode === 'business' ? 'business' : 'personal') }
      else { lsSet(CTX_KEY, ctx) }
      toast.success(t('saved_msg'))
      onClose?.()
    } catch (e) { toast.error(e?.message || t('error')) } finally { setSaving(false) }
  }

  const initial = (name.trim()[0] || 'U').toUpperCase()
  const showBiz = mode === 'business' || mode === 'both'
  const card = 'rounded-2xl bg-zinc-100 border border-zinc-200/60 dark:bg-[#141416] dark:border-white/5 p-4'

  return (
    <Sheet open={open} onClose={onClose} full title={t('profile')} right={<SheetTextButton bold onClick={save} data-testid="profile-save">{saving ? '...' : t('save')}</SheetTextButton>}>
      {/* Context switcher for Both mode */}
      {mode === 'both' ? (
        <div className="mb-4">
          <Segmented value={ctx} onChange={(v) => { setCtx(v); lsSet(CTX_KEY, v) }} options={[{ id: 'personal', label: t('personal') }, { id: 'business', label: t('business') }]} />
        </div>
      ) : null}

      <div className="flex flex-col items-center pt-1">
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onAvatar} />
        <button type="button" onClick={() => fileRef.current?.click()} className="relative">
          <div className="h-24 w-24 rounded-full bg-foreground text-background text-3xl font-bold flex items-center justify-center overflow-hidden">
            {avatar ? <img src={avatar} alt="avatar" className="h-full w-full object-cover" /> : initial}
          </div>
          <span className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-background border border-border flex items-center justify-center shadow"><Camera size={16} /></span>
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} className="text-sm font-semibold mt-3">{avatar ? t('change_photo') : t('add_photo')}</button>
        {!isGuest && session?.user?.email ? <p className="text-xs text-muted-foreground mt-1">{session.user.email}</p> : null}
      </div>

      <div className="space-y-6 mt-7">
        <Field label={t('full_name')}><TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder={t('profile_full_name_ph')} data-testid="profile-name" /></Field>

        <div>
          <Field label={t('how_you_use')}>
            <Segmented value={mode} onChange={setMode} options={[{ id: 'personal', label: t('personal') }, { id: 'business', label: t('business') }, { id: 'both', label: t('both') }]} />
          </Field>
          <p className="text-xs text-muted-foreground mt-2 px-1 leading-snug">{t('usage_both_hint')}</p>
        </div>

        {showBiz ? (
          <>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2 px-1 flex items-center gap-1.5"><Building2 size={13} /> {t('invoice_business_config')}</p>
              <div className={cn(card, 'space-y-4')}>
                <div>
                  <p className="text-sm font-medium mb-1.5">{t('company_logo_invoice')}</p>
                  <input ref={logoRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={onLogo} />
                  <button type="button" onClick={() => logoRef.current?.click()} className="w-full aspect-[3/1] rounded-xl border border-dashed border-border flex items-center justify-center overflow-hidden bg-background" data-testid="profile-logo">
                    {biz.logo ? <img src={biz.logo} alt="logo" className="h-full w-full object-contain" /> : <span className="flex flex-col items-center text-muted-foreground text-xs"><ImagePlus size={20} strokeWidth={1.5} /> <span className="mt-1">PNG / JPG · 3:1</span></span>}
                  </button>
                </div>
                <Field label={t('company_name')}><TextInput value={biz.companyName} onChange={(e) => setB({ companyName: e.target.value })} placeholder={t('profile_business_name')} /></Field>
                <Field label={t('address')}><TextInput value={biz.address} onChange={(e) => setB({ address: e.target.value })} placeholder={t('profile_business_address')} /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t('phone')}><TextInput value={biz.phone} onChange={(e) => setB({ phone: e.target.value })} placeholder="+62..." inputMode="tel" /></Field>
                  <Field label={t('email')}><TextInput value={biz.email} onChange={(e) => setB({ email: e.target.value })} placeholder={t('email_ph')} inputMode="email" /></Field>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2 px-1">{t('invoice_bank_account')}</p>
              <div className={cn(card, 'space-y-4')}>
                <Field label={t('bank_name')}>
                  <input list="id-banks" value={biz.bankName} onChange={(e) => setB({ bankName: e.target.value })} placeholder={t('profile_bank_list_ph')} className="w-full rounded-xl bg-background border border-border/60 dark:border-white/10 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-ring/60 placeholder:text-muted-foreground" />
                  <datalist id="id-banks">{ID_BANKS.map((b) => <option key={b} value={b} />)}</datalist>
                </Field>
                <Field label={t('account_holder')}><TextInput value={biz.accHolder} onChange={(e) => setB({ accHolder: e.target.value })} placeholder={t('profile_bank_account_name')} /></Field>
                <Field label={t('account_number')}><TextInput value={biz.accNumber} onChange={(e) => setB({ accNumber: e.target.value })} placeholder="1234567890" inputMode="numeric" /></Field>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-2 px-1">{t('tax_business_details')}</p>
              <div className={cn(card, 'space-y-4')}>
                <Field label={t('company_legal_name')}><TextInput value={biz.legalName} onChange={(e) => setB({ legalName: e.target.value })} placeholder="PT / CV / UD ..." /></Field>
                <Field label={t('npwp')}><TextInput value={biz.npwp} onChange={(e) => setB({ npwp: e.target.value })} placeholder="01.234.567.8-901.000 / NIK 16 digit" inputMode="numeric" /></Field>
                <Field label={t('nib_oss')}><TextInput value={biz.nib} onChange={(e) => setB({ nib: e.target.value })} placeholder="1234567890123" inputMode="numeric" /></Field>
                <Field label={t('tax_status')}>
                  <Segmented value={biz.taxStatus} onChange={(v) => setB({ taxStatus: v })} options={[{ id: 'nonpkp', label: t('non_pkp') }, { id: 'pkp', label: t('pkp_label') }]} />
                </Field>
              </div>
            </div>

            <Field label={`${t('business_opening_balance')} (${getCurrency(home).symbol})`}>
              <TextInput value={biz.openingBalance} onChange={(e) => setB({ openingBalance: sanitizeAmount(e.target.value) })} placeholder="0" inputMode="decimal" type="text" data-testid="profile-biz-balance" />
            </Field>
          </>
        ) : null}

        <PrimaryButton onClick={save} disabled={saving} data-testid="profile-save-btn">{t('save_changes')}</PrimaryButton>
        <div className="h-2" />
      </div>
    </Sheet>
  )
}