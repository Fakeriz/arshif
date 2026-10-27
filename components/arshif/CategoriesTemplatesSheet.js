'use client'
import { useEffect, useState } from 'react'
import { Utensils, ShoppingBasket, Car, Receipt, ShoppingBag, Clapperboard, HeartPulse, GraduationCap, CircleDashed, Wallet, Laptop, TrendingUp, Briefcase, Gift, Home, Plane, Coffee, Zap, Heart, Smartphone, Plus, Trash2, Pencil, Search } from 'lucide-react'
import { toast } from 'sonner'
import { useApp } from './context'
import { Sheet, Segmented, TextInput, Field, PrimaryButton } from './ui'
import { CATEGORIES } from '@/lib/categories'
import { getCurrency } from '@/lib/currencies'
import { cn } from '@/lib/utils'
import { sanitizeAmount } from '@/lib/amount'

const ICONS = { Utensils, ShoppingBasket, Car, Receipt, ShoppingBag, Clapperboard, HeartPulse, GraduationCap, CircleDashed, Wallet, Laptop, TrendingUp, Briefcase, Gift, Home, Plane, Coffee, Zap, Heart, Smartphone }
const ICON_KEYS = ['Utensils', 'ShoppingBasket', 'Car', 'Receipt', 'ShoppingBag', 'Clapperboard', 'HeartPulse', 'GraduationCap', 'Wallet', 'TrendingUp', 'Briefcase', 'Gift', 'Home', 'Plane', 'Coffee', 'Zap', 'Heart', 'Smartphone', 'CircleDashed']

const PRESETS = [
  { name: 'Food & Dining', icon: 'Utensils', type: 'expense' },
  { name: 'Groceries', icon: 'ShoppingBasket', type: 'expense' },
  { name: 'Transport', icon: 'Car', type: 'expense' },
  { name: 'Bills & Utilities', icon: 'Receipt', type: 'expense' },
  { name: 'Shopping', icon: 'ShoppingBag', type: 'expense' },
  { name: 'Entertainment', icon: 'Clapperboard', type: 'expense' },
  { name: 'Healthcare', icon: 'HeartPulse', type: 'expense' },
  { name: 'Education', icon: 'GraduationCap', type: 'expense' },
  { name: 'Others', icon: 'CircleDashed', type: 'expense' },
  { name: 'Salary', icon: 'Wallet', type: 'income' },
  { name: 'Freelance', icon: 'Laptop', type: 'income' },
  { name: 'Investment', icon: 'TrendingUp', type: 'income' },
  { name: 'Business', icon: 'Briefcase', type: 'income' },
  { name: 'Bonus', icon: 'Gift', type: 'income' },
  { name: 'Others', icon: 'CircleDashed', type: 'income' },
]
const SEED_FLAG = 'arshif_cats_seeded'

export default function CategoriesTemplatesSheet({ open, onClose }) {
  const { t, home, fmt, accounts = [], store, open: openSheet, close } = useApp()
  const [tab, setTab] = useState('categories')
  const [sub, setSub] = useState('expense')
  const [searchQuery, setSearchQuery] = useState('')
  const [cats, setCats] = useState([])
  const [templates, setTemplates] = useState([])

  // add-category form
  const [addingCat, setAddingCat] = useState(false)
  const [catName, setCatName] = useState('')
  const [catIcon, setCatIcon] = useState('Utensils')

  // add-template form
  const [addingTpl, setAddingTpl] = useState(false)
  const [tTitle, setTTitle] = useState('')
  const [tAmount, setTAmount] = useState('')
  const [tCategory, setTCategory] = useState('food')
  const [tAccount, setTAccount] = useState(null)

  const loadCats = async () => { try { setCats((await store.listCategories()) || []) } catch { setCats([]) } }
  const loadTpl = async () => { try { setTemplates((await store.listTemplates()) || []) } catch { setTemplates([]) } }

  useEffect(() => {
    if (!open) return
    setTab('categories'); setSub('expense'); setAddingCat(false); setAddingTpl(false)
    ;(async () => {
      try {
        const existing = (await store.listCategories()) || []
        const seeded = (() => { try { return localStorage.getItem(SEED_FLAG) === '1' } catch { return false } })()
        if (existing.length === 0 && !seeded) {
          for (const c of PRESETS) { await store.createCategory({ name: c.name, icon: c.icon, type: c.type, preset: true }) }
          try { localStorage.setItem(SEED_FLAG, '1') } catch {}
        }
      } catch {}
      await loadCats(); await loadTpl()
    })()
  }, [open]) // eslint-disable-line

  const filteredCats = (cats || []).filter((c) => {
    if ((c?.type || 'expense') !== sub) return false
    if (!searchQuery.trim()) return true
    return (c?.name || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
  })
  const filteredTpls = (templates || []).filter((tp) => {
    if (!searchQuery.trim()) return true
    const term = searchQuery.trim().toLowerCase()
    return (tp?.title || '').toLowerCase().includes(term) || (tp?.category || '').toLowerCase().includes(term)
  })
  const expenseCats = CATEGORIES.filter((c) => c.types?.includes('expense'))

  const saveCat = async () => {
    if (!catName.trim()) return
    try { await store.createCategory({ name: catName.trim(), icon: catIcon, type: sub, preset: false }); setCatName(''); setCatIcon('Utensils'); setAddingCat(false); await loadCats(); toast.success(t('saved_msg')) } catch (e) { toast.error(e?.message || t('error')) }
  }
  const editCat = async (c) => {
    const name = typeof window !== 'undefined' ? window.prompt('Category name', c?.name || '') : null
    if (name == null) return
    try { await store.updateCategory(c.id, { name: name.trim() || c.name }); await loadCats() } catch (e) { toast.error(e?.message || t('error')) }
  }
  const delCat = async (c) => { try { await store.deleteCategory(c.id); await loadCats() } catch (e) { toast.error(e?.message || t('error')) } }

  const saveTpl = async () => {
    if (!tTitle.trim() || !(Number(tAmount) || 0)) return
    try { await store.createTemplate({ title: tTitle.trim(), amount: Number(tAmount), currency: home, category: tCategory, account_id: tAccount }); setTTitle(''); setTAmount(''); setTCategory('food'); setTAccount(null); setAddingTpl(false); await loadTpl(); toast.success(t('saved_msg')) } catch (e) { toast.error(e?.message || t('error')) }
  }
  const delTpl = async (tp) => { try { await store.deleteTemplate(tp.id); await loadTpl() } catch (e) { toast.error(e?.message || t('error')) } }
  const useTpl = (tp) => {
    close('catman')
    setTimeout(() => openSheet('addTx', { type: 'expense', amount: tp?.amount, currency: tp?.currency || home, category: tp?.category || 'other', account_id: tp?.account_id || null, note: tp?.title || '' }), 160)
  }

  return (
    <Sheet open={open} onClose={onClose} full title={t('categories_templates')}>
      <Segmented className="mt-1" value={tab} onChange={setTab} options={[{ id: 'categories', label: 'Categories' }, { id: 'templates', label: 'Quick Templates' }]} />

      <div className="w-full py-2 box-border">
        <div className="relative flex items-center w-full">
          <Search className="absolute left-3.5 text-muted-foreground pointer-events-none shrink-0" size={16} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search')}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl text-sm bg-muted/40 border border-border/40 text-foreground placeholder-muted-foreground outline-none focus:border-border transition-colors"
          />
        </div>
      </div>

      {tab === 'categories' ? (
        <div className="pt-4">
          <Segmented size="sm" value={sub} onChange={setSub} options={[{ id: 'expense', label: t('expense') }, { id: 'income', label: t('income_tab') }]} />
          <div className="mt-4 space-y-2">
            {filteredCats.map((c) => {
              const Icon = ICONS[c?.icon] || CircleDashed
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 px-3.5 py-3" data-testid="cat-row">
                  <div className="h-9 w-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white"><Icon size={18} strokeWidth={1.5} /></div>
                  <span className="flex-1 font-bold text-[15px] truncate text-zinc-950 dark:text-white">{c?.name}</span>
                  <button type="button" onClick={() => editCat(c)} className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white transition-colors" aria-label="edit"><Pencil size={15} /></button>
                  <button type="button" onClick={() => delCat(c)} className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 transition-colors" aria-label="delete"><Trash2 size={15} /></button>
                </div>
              )
            })}
            {filteredCats.length === 0 ? <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-6">—</p> : null}
          </div>

          {addingCat ? (
            <div className="mt-4 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-4 space-y-3">
              <TextInput value={catName} onChange={(e) => setCatName(e.target.value)} placeholder={t('category_name_placeholder')} data-testid="cat-name" />
              <div className="flex items-center gap-2 overflow-x-auto py-1 no-scrollbar">
                {ICON_KEYS.map((k) => {
                  const Icon = ICONS[k]
                  const active = catIcon === k
                  return (
                    <button key={k} type="button" onClick={() => setCatIcon(k)} className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0 border transition-colors', active ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white' : 'bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300')}>
                      <Icon size={17} strokeWidth={1.5} />
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAddingCat(false)} className="flex-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 py-2.5 font-semibold text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors">{t('cancel')}</button>
                <button type="button" onClick={saveCat} disabled={!catName.trim()} className={cn('flex-1 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 py-2.5 font-bold text-sm transition-colors', !catName.trim() && 'opacity-40')} data-testid="cat-save">{t('save')}</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAddingCat(true)} className="mt-4 w-full rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 py-3.5 font-bold text-[15px] flex items-center justify-center gap-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors" data-testid="cat-add">
              <Plus size={18} /> Add Custom Category
            </button>
          )}
          <div className="h-6" />
        </div>
      ) : (
        <div className="pt-4">
          <div className="space-y-2">
            {filteredTpls.map((tp) => (
              <div key={tp.id} className="flex items-center gap-3 rounded-xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 px-4 py-3.5" data-testid="tpl-row">
                <button type="button" onClick={() => useTpl(tp)} className="flex-1 text-left min-w-0">
                  <p className="font-bold text-[15px] truncate text-zinc-950 dark:text-white">{tp?.title}</p>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{t(`cat_${tp?.category || 'other'}`)} · {fmt(tp?.amount, tp?.currency || home)}</p>
                </button>
                <span className="font-bold tabular-nums text-[15px] text-zinc-950 dark:text-white">{getCurrency(tp?.currency || home).symbol} {fmt(tp?.amount, tp?.currency || home)}</span>
                <button type="button" onClick={() => delTpl(tp)} className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-rose-500 dark:text-zinc-500 dark:hover:text-rose-400 transition-colors" aria-label="delete"><Trash2 size={15} /></button>
              </div>
            ))}
            {filteredTpls.length === 0 ? <p className="text-center text-sm text-zinc-500 dark:text-zinc-400 py-6">{t('no_templates')}</p> : null}
          </div>

          {addingTpl ? (
            <div className="mt-4 rounded-2xl bg-white dark:bg-[#1c1c1e] border border-zinc-200 dark:border-white/10 p-4 space-y-3">
              <Field label="Title"><TextInput value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="e.g. Morning coffee" data-testid="tpl-title" /></Field>
              <Field label={`Amount (${home})`}><TextInput type="text" inputMode="decimal" value={tAmount} onChange={(e) => setTAmount(sanitizeAmount(e.target.value))} placeholder="0" data-testid="tpl-amount" /></Field>
              <Field label={t('category')}>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  {expenseCats.map((c) => (
                    <button key={c.id} type="button" onClick={() => setTCategory(c.id)} className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors', tCategory === c.id ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white' : 'bg-white dark:bg-[#1c1c1e] border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white')}>{t(`cat_${c.id}`)}</button>
                  ))}
                </div>
              </Field>
              <Field label={t('source_account')}>
                <div className="flex gap-2 overflow-x-auto no-scrollbar">
                  <button type="button" onClick={() => setTAccount(null)} className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors', tAccount === null ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white' : 'bg-white dark:bg-[#1c1c1e] border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white')}>{t('no_account_opt')}</button>
                  {(accounts || []).map((a) => (
                    <button key={a.id} type="button" onClick={() => setTAccount(a.id)} className={cn('shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors', tAccount === a.id ? 'bg-zinc-950 text-white border-zinc-950 dark:bg-white dark:text-zinc-950 dark:border-white' : 'bg-white dark:bg-[#1c1c1e] border-zinc-200 dark:border-white/10 text-zinc-950 dark:text-white')}>{a.name}</button>
                  ))}
                </div>
              </Field>
              <div className="flex gap-2">
                <button type="button" onClick={() => setAddingTpl(false)} className="flex-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-white/10 py-2.5 font-semibold text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors">{t('cancel')}</button>
                <button type="button" onClick={saveTpl} disabled={!tTitle.trim() || !(Number(tAmount) || 0)} className={cn('flex-1 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 py-2.5 font-bold text-sm transition-colors', (!tTitle.trim() || !(Number(tAmount) || 0)) && 'opacity-40')} data-testid="tpl-save">{t('save')}</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setAddingTpl(true)} className="mt-4 w-full rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 py-3.5 font-bold text-[15px] flex items-center justify-center gap-2 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors" data-testid="tpl-add">
              <Plus size={18} /> Create New Template
            </button>
          )}
          <div className="h-6" />
        </div>
      )}
    </Sheet>
  )
}