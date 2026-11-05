import { useState } from 'react';

import { insertAccount, updateProfile } from '@/data/remote/api';
import type { Account } from '@/data/types';
import { useStore } from '@/state/AppStore';

import { parsePayday, type SetupDraft } from './draft';

/**
 * Simpan hasil setup (FR-AUTH-2): akun pertama, lalu profil (mata uang, penghasilan, gajian, pembagian,
 * akun aktif, onboarded_at). onboarded di state lokal diset PALING AKHIR karena itu memindahkan gerbang rute.
 * Bila profil gagal disimpan setelah akun dibuat, percobaan berikutnya memakai akun yang sama (tidak dobel).
 */
export function useFinishSetup() {
  const { dispatch, userId } = useStore();
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [created, setCreated] = useState<Account | null>(null);

  const finish = async (d: SetupDraft) => {
    if (!userId || saving) return;
    setSaving(true);
    setFailed(false);
    try {
      let account = created;
      if (!account) {
        account = await insertAccount({
          bank: d.account.bank,
          name: d.account.name.trim(),
          type: d.account.type,
          currency: d.account.currency,
          openingBalance: d.account.opening ?? 0,
        });
        setCreated(account);
        dispatch({ type: 'account/add', account });
      }
      const income = d.income ?? 0;
      const payday = parsePayday(d.payday) ?? 1;
      await updateProfile(userId, {
        main_currency: d.mainCurrency,
        monthly_income: income,
        payday,
        split_needs: d.split.needs,
        split_wants: d.split.wants,
        split_savings: d.split.savings,
        active_account_id: account.id,
        onboarded_at: new Date().toISOString(),
      });
      // Pembagian sudah tersimpan di atas; aksi ini menyamakan state lokal (penulisan ulang ke server idempoten).
      dispatch({ type: 'budget/split', split: d.split });
      dispatch({ type: 'profile/set', patch: { onboarded: true, income, payday, mainCurrency: d.mainCurrency } });
    } catch {
      setFailed(true);
      setSaving(false);
    }
  };

  return { finish, saving, failed };
}
