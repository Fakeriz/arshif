import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../supabase'
import { guestStore, DEFAULT_PROFILE } from './guest-store'
import { supabaseStore, fetchAllRows } from './supabase-store'
import { LS, lsGet, lsSet, wrapError } from './shared'

function createStore(session) {
  const scope = session?.user?.id || 'guest'
  const base = session?.user?.id ? supabaseStore(session.user.id, session.user.user_metadata || {}) : guestStore()
  const categories = hybridColl(session, 'categories', `arshif_categories_${scope}`)
  const templates = hybridColl(session, 'transaction_templates', `arshif_templates_${scope}`)
  const debts = hybridColl(session, 'debts', `arshif_debts_${scope}`)
  const budgets = session?.user?.id
    ? strictHybridColl(session.user.id, 'budgets')
    : localColl(`arshif_budgets_${scope}`)
  const bills = billsStore(session, scope)
  const splitBills = session?.user?.id
    ? strictHybridColl(session.user.id, 'split_bills')
    : localColl(`arshif_split_bills_${scope}`)
  return {
    ...base,
    ...bills,
    ...localSubscriptions(session, scope, bills),
    listSplitBills: () => splitBills.list(),
    createSplitBill: (r) => splitBills.create(r),
    updateSplitBill: (id, p) => splitBills.update(id, p),
    deleteSplitBill: (id) => splitBills.remove(id),
    listCategories: () => categories.list(),
    createCategory: (r) => categories.create(r),
    updateCategory: (id, p) => categories.update(id, p),
    deleteCategory: (id) => categories.remove(id),
    listTemplates: () => templates.list(),
    createTemplate: (r) => templates.create(r),
    updateTemplate: (id, p) => templates.update(id, p),
    deleteTemplate: (id) => templates.remove(id),
    listDebts: () => debts.list(),
    createDebt: (r) => debts.create(r),
    updateDebt: (id, p) => debts.update(id, p),
    deleteDebt: (id) => debts.remove(id),
    listBudgets: () => budgets.list(),
    createBudget: (r) => budgets.create(r),
    updateBudget: (id, p) => budgets.update(id, p),
    deleteBudget: (id) => budgets.remove(id),
    ...netWorthStore(session, scope),
  }
}

function localColl(key) {
  return {
    async list() { return lsGet(key, []) || [] },
    async create(row) { const list = lsGet(key, []) || []; const r = { id: uuidv4(), created_at: new Date().toISOString(), ...row }; lsSet(key, [...list, r]); return r },
    async update(id, patch) { const list = (lsGet(key, []) || []).map((x) => (x.id === id ? { ...x, ...patch } : x)); lsSet(key, list); return list.find((x) => x.id === id) },
    async remove(id) { lsSet(key, (lsGet(key, []) || []).filter((x) => x.id !== id)) },
  }
}

function strictHybridColl(uid, tableName) {
  const tbl = () => supabase.from(tableName)
  return {
    async list() {
      const { data, error } = await tbl().select('*').eq('user_id', uid).order('created_at')
      if (error) throw wrapError(error)
      return data || []
    },
    async create(row) {
      const { data, error } = await tbl().insert({ ...row, user_id: uid }).select().maybeSingle()
      if (error) throw wrapError(error)
      return data
    },
    async update(id, patch) {
      const { data, error } = await tbl().update(patch).eq('id', id).eq('user_id', uid).select().maybeSingle()
      if (error) throw wrapError(error)
      return data
    },
    async remove(id) {
      const { error } = await tbl().delete().eq('id', id).eq('user_id', uid)
      if (error) throw wrapError(error)
    },
  }
}

function hybridColl(session, tableName, key) {
  const uid = session?.user?.id
  const local = localColl(key)
  if (!uid) return local
  const tbl = () => supabase.from(tableName)
  return {
    async list() {
      try { const { data, error } = await tbl().select('*').eq('user_id', uid).order('created_at'); if (error) throw error; return data || [] }
      catch { return local.list() }
    },
    async create(row) {
      try { const { data, error } = await tbl().insert({ ...row, user_id: uid }).select().maybeSingle(); if (error) throw error; return data }
      catch { return local.create(row) }
    },
    async update(id, patch) {
      try { const { data, error } = await tbl().update(patch).eq('id', id).eq('user_id', uid).select().maybeSingle(); if (error) throw error; return data }
      catch { return local.update(id, patch) }
    },
    async remove(id) {
      try { const { error } = await tbl().delete().eq('id', id).eq('user_id', uid); if (error) throw error }
      catch { return local.remove(id) }
    },
  }
}

function billsStore(session, scope) {
  const uid = session?.user?.id
  const key = `arshif_bills_${scope}`
  if (!uid) {
    return {
      async listBills() { return lsGet(key, []) || [] },
      async createBill(b) {
        const list = lsGet(key, []) || []
        const bill = { id: uuidv4(), created_at: new Date().toISOString(), paid_months: {}, ...b }
        lsSet(key, [...list, bill])
        return bill
      },
      async updateBill(id, patch) {
        const list = (lsGet(key, []) || []).map((x) => (x.id === id ? { ...x, ...patch } : x))
        lsSet(key, list)
        return list.find((x) => x.id === id)
      },
      async deleteBill(id) { lsSet(key, (lsGet(key, []) || []).filter((x) => x.id !== id)) },
    }
  }

  const tbl = () => supabase.from('bills')
  return {
    async listBills() {
      const { data, error } = await tbl().select('*').eq('user_id', uid).order('created_at')
      if (error) throw wrapError(error)
      return data || []
    },
    async createBill(b) {
      const { data, error } = await tbl().insert({ ...b, user_id: uid }).select().maybeSingle()
      if (error) throw wrapError(error)
      return data
    },
    async updateBill(id, patch) {
      const { data, error } = await tbl().update(patch).eq('id', id).eq('user_id', uid).select().maybeSingle()
      if (error) throw wrapError(error)
      return data
    },
    async deleteBill(id) {
      const { error } = await tbl().delete().eq('id', id).eq('user_id', uid)
      if (error) throw wrapError(error)
    },
  }
}

function localSubscriptions(session, scope, billsStore) {
  const key = `arshif_subscriptions_${scope}`
  const billsKey = `arshif_bills_${scope}`
  const uid = session?.user?.id
  const localBillMode = !uid
  const localBillList = () => lsGet(billsKey, []) || []

  const readLocal = () => lsGet(key, []) || []
  const writeLocal = (list) => lsSet(key, list)

  const createMirrorBill = async (bill) => {
    if (localBillMode) {
      const list = localBillList()
      lsSet(billsKey, [...list, bill])
      return bill
    }
    return billsStore.createBill(bill)
  }

  const updateMirrorBill = async (id, patch) => {
    if (localBillMode) {
      const list = localBillList().map((x) => (x.id === id ? { ...x, ...patch } : x))
      lsSet(billsKey, list)
      return list.find((x) => x.id === id)
    }
    return billsStore.updateBill(id, patch)
  }

  const removeMirrorBills = async (subscriptionId) => {
    if (localBillMode) {
      lsSet(billsKey, localBillList().filter((b) => b.subscription_id !== subscriptionId))
      return
    }
    const list = await billsStore.listBills()
    await Promise.all(list.filter((b) => b.subscription_id === subscriptionId).map((b) => billsStore.deleteBill(b.id)))
  }

  const syncGoal = async (action, sub) => {
    if (!uid) return
    try {
      if (action === 'create' || action === 'update') {
        const payload = {
          id: sub.id,
          user_id: uid,
          name: sub.name || sub.title || 'Subscription',
          target_amount: Number(sub.amount) || 0,
          currency: sub.currency || 'USD',
          type: 'subscription',
          deadline: sub.next_billing_date || null,
        }
        const { error } = await supabase.from('goals').upsert(payload)
        if (error && (error.code === 'PGRST204' || error.code === '42703' || /does not exist/i.test(error.message || ''))) {
          const { type: _, ...safe } = payload
          await supabase.from('goals').upsert(safe)
        }
      } else if (action === 'delete') {
        await supabase.from('goals').delete().eq('id', sub.id).eq('user_id', uid)
      }
    } catch (e) {
      console.warn('Goals subscription sync notice:', e?.message)
    }
  }

  const getDueDay = (sub) => {
    if (sub.next_billing_date) {
      const parts = sub.next_billing_date.split('-')
      if (parts.length === 3) {
        const parsed = parseInt(parts[2], 10)
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 31) return parsed
      }
    }
    return Math.min(31, Math.max(1, Number(sub.due_day) || 1))
  }

  // Sumber data utama: Supabase (user login) dengan fallback localStorage.
  // Saat tabel subscriptions baru pertama kali dipakai, data lama di localStorage
  // dimigrasikan sekali ke Supabase dengan id yang sama agar mirror bill & goal
  // yang sudah ada tetap cocok.
  const migrateLocalToRemote = async () => {
    const local = readLocal()
    if (!local.length) return
    for (const item of local) {
      try {
        await supabase.from('subscriptions').insert({ ...item, user_id: uid })
      } catch (e) {
        console.warn('Subscription migration skip:', e?.message)
        return
      }
    }
  }

  const remoteList = async () => {
    const { data, error } = await supabase.from('subscriptions').select('*').eq('user_id', uid).order('created_at')
    if (error) throw error
    return data || []
  }

  return {
    async listSubscriptions() {
      if (!uid) return readLocal()
      try {
        const remote = await remoteList()
        if (remote.length === 0 && readLocal().length > 0) {
          await migrateLocalToRemote()
          return readLocal()
        }
        return remote
      } catch {
        return readLocal()
      }
    },
    async createSubscription(s) {
      const sub = {
        id: uuidv4(),
        created_at: new Date().toISOString(),
        show_as_bill: true,
        ...s,
      }
      sub.due_day = getDueDay(sub)

      let persisted = false
      if (uid) {
        try {
          await supabase.from('subscriptions').insert({ ...sub, user_id: uid })
          persisted = true
        } catch (e) {
          console.warn('Subscription remote create fell back to local:', e?.message)
        }
      }
      if (!persisted) {
        const list = readLocal()
        writeLocal([...list, sub])
      }

      if (sub.show_as_bill) {
        await createMirrorBill({
          id: uuidv4(),
          created_at: new Date().toISOString(),
          title: sub.name || sub.title,
          amount: sub.amount,
          currency: sub.currency,
          due_day: sub.due_day,
          next_billing_date: sub.next_billing_date || null,
          cycle: sub.cycle || 'monthly',
          category: sub.category || 'cat_bills',
          account_id: sub.account_id || null,
          payment_method: sub.payment_method || 'card',
          auto_log_expense: Boolean(sub.auto_log_expense),
          is_subscription_mirror: true,
          subscription_id: sub.id,
          cover_url: sub.cover_url || null,
          paid_months: {},
        })
      }

      await syncGoal('create', sub)
      return sub
    },
    async updateSubscription(id, patch) {
      let updated = null
      if (uid) {
        try {
          const { data, error } = await supabase.from('subscriptions').update(patch).eq('id', id).eq('user_id', uid).select().maybeSingle()
          if (error) throw error
          updated = data || null
        } catch (e) {
          console.warn('Subscription remote update fell back to local:', e?.message)
        }
      }
      if (!updated) {
        const list = readLocal().map((x) => (x.id === id ? { ...x, ...patch } : x))
        writeLocal(list)
        updated = list.find((x) => x.id === id)
      }
      if (updated) {
        updated.due_day = getDueDay(updated)
        const bills = await billsStore.listBills()
        const existing = bills.find((b) => b.subscription_id === id)
        if (updated.show_as_bill) {
          const mirrorData = {
            title: updated.name || updated.title,
            amount: updated.amount,
            currency: updated.currency,
            due_day: updated.due_day,
            next_billing_date: updated.next_billing_date || null,
            cycle: updated.cycle || 'monthly',
            category: updated.category || 'cat_bills',
            account_id: updated.account_id || null,
            payment_method: updated.payment_method || 'card',
            auto_log_expense: Boolean(updated.auto_log_expense),
            is_subscription_mirror: true,
            subscription_id: updated.id,
            cover_url: updated.cover_url || null,
          }
          if (existing) {
            await updateMirrorBill(existing.id, mirrorData)
          } else {
            await createMirrorBill({
              id: uuidv4(),
              created_at: new Date().toISOString(),
              ...mirrorData,
              paid_months: {},
            })
          }
        } else {
          await removeMirrorBills(id)
        }
        await syncGoal('update', updated)
      }
      return updated
    },
    async deleteSubscription(id) {
      if (uid) {
        try {
          const { error } = await supabase.from('subscriptions').delete().eq('id', id).eq('user_id', uid)
          if (error) throw error
        } catch (e) {
          console.warn('Subscription remote delete fell back to local:', e?.message)
          writeLocal(readLocal().filter((x) => x.id !== id))
        }
      } else {
        writeLocal(readLocal().filter((x) => x.id !== id))
      }
      await removeMirrorBills(id)
      await syncGoal('delete', { id })
    },
  }
}

// Net Worth entries: aset/liabilitas manual dengan kategori, sync Supabase + fallback lokal.
// Snapshot bulanan dibuat otomatis oleh trigger DB.
function netWorthStore(session, scope) {
  const key = LS.net_worth_entries || 'arshif_guest_networth_entries'
  const snapKey = `arshif_guest_nw_snap_${scope}`
  const uid = session?.user?.id
  const readLocal = () => lsGet(key, []) || []
  const writeLocal = (list) => lsSet(key, list)
  const readSnapLocal = () => lsGet(snapKey, []) || []
  const writeSnapLocal = (list) => lsSet(snapKey, list)

  const migrate = async () => {
    const local = readLocal()
    if (!local.length || !uid) return
    for (const item of local) {
      try { await supabase.from('net_worth_entries').insert({ ...item, user_id: uid }) } catch { return }
    }
  }

  const remoteList = async (type) => {
    const { data, error } = await supabase.from('net_worth_entries')
      .select('*').eq('user_id', uid).eq('type', type).order('created_at')
    if (error) throw error
    return data || []
  }

  const remoteSnapshot = async () => {
    const { data, error } = await supabase.from('net_worth_snapshots')
      .select('*').eq('user_id', uid).order('month', { ascending: false }).limit(12)
    if (error) throw error
    return (data || []).reverse()
  }

  return {
    async listNetWorthEntries(type = 'asset') {
      if (!uid) return readLocal().filter((e) => e.type === type)
      try {
        const rows = await remoteList(type)
        if (rows.length === 0 && readLocal().some((e) => e.type === type)) {
          await migrate()
          return readLocal().filter((e) => e.type === type)
        }
        return rows
      } catch { return readLocal().filter((e) => e.type === type) }
    },
    async createNetWorthEntry(entry) {
      const item = { id: uuidv4(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), type: entry.type || 'asset', ...entry }
      if (uid) {
        try { await supabase.from('net_worth_entries').insert({ ...item, user_id: uid }); return item } catch (e) { console.warn('NW remote create fell back to local:', e?.message) }
      }
      const list = readLocal()
      writeLocal([...list, item])
      return item
    },
    async updateNetWorthEntry(id, patch) {
      if (uid) {
        try {
          const { data } = await supabase.from('net_worth_entries').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', uid).select().maybeSingle()
          if (data) return data
        } catch (e) { console.warn('NW remote update fell back to local:', e?.message) }
      }
      const list = readLocal().map((x) => (x.id === id ? { ...x, ...patch, updated_at: new Date().toISOString() } : x))
      writeLocal(list)
      return list.find((x) => x.id === id)
    },
    async deleteNetWorthEntry(id) {
      if (uid) {
        try { await supabase.from('net_worth_entries').delete().eq('id', id).eq('user_id', uid); return } catch (e) { console.warn('NW remote delete fell back to local:', e?.message) }
      }
      writeLocal(readLocal().filter((x) => x.id !== id))
    },
    async listNetWorthSnapshots() {
      if (!uid) return readSnapLocal()
      try { return await remoteSnapshot() } catch { return readSnapLocal() }
    },
  }
}

export { createStore, DEFAULT_PROFILE, fetchAllRows }
