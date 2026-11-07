import { act, render } from '@testing-library/react-native';

import { ToastProvider } from '@/components/ui';
import type { Goal } from '@/data/planning';
import type { PlanningData } from '@/data/remote/planning';
import { sampleState } from '@/data/sample-state';
import { I18nProvider } from '@/i18n';
import { AppStoreProvider, useStore } from '@/state/AppStore';
import { PlanningProvider, usePlanning, type PayInput } from '@/state/planning';
import { ThemeProvider } from '@/theme/ThemeProvider';

const mockInsertDeposit = jest.fn();
jest.mock('@/data/remote/planning', () => ({
  ...jest.requireActual('@/data/remote/planning'),
  insertDeposit: (...a: unknown[]) => mockInsertDeposit(...a),
}));

const base = sampleState();
const goal: Goal = { id: 'g1', name: 'Dana darurat', target: 1_000_000, currency: 'IDR', collected: 0, status: 'active' };
const NO_PLANNING: PlanningData = { goals: [goal], deposits: [], bills: [], debts: [], payments: [], subscriptions: [], splits: [] };

let ctx: { app: ReturnType<typeof useStore>; planning: ReturnType<typeof usePlanning> };
function Probe() {
  ctx = { app: useStore(), planning: usePlanning() };
  return null;
}

it('coba ulang setoran setelah catatan setoran gagal tidak memotong rekening dua kali', async () => {
  await render(
    <I18nProvider initialLang="id">
      <ThemeProvider initialMode="dark">
        <ToastProvider>
          <AppStoreProvider preset={base}>
            <PlanningProvider preset={NO_PLANNING}>
              <Probe />
            </PlanningProvider>
          </AppStoreProvider>
        </ToastProvider>
      </ThemeProvider>
    </I18nProvider>,
  );
  const before = ctx.app.state.transactions.length;
  // Satu id per lembar bayar (PaySheet): percobaan kedua memakai id yang sama.
  const p: PayInput = { id: 'pay-1', amount: 50_000, accountId: base.accounts[0]!.id, date: '2026-11-07' };

  mockInsertDeposit.mockRejectedValueOnce(new Error('network'));
  await act(async () => {
    await expect(ctx.planning.depositGoal(goal, p)).rejects.toThrow('network');
  });
  expect(ctx.app.state.transactions.length).toBe(before + 1);

  mockInsertDeposit.mockResolvedValueOnce({
    deposit: { id: 'pay-1', goalId: 'g1', amount: 50_000, date: '2026-11-07', transactionId: 'pay-1' },
    goal: { ...goal, collected: 50_000 },
  });
  await act(async () => {
    await ctx.planning.depositGoal(goal, p);
  });
  // Transaksi dari percobaan pertama dipakai ulang; setoran memakai id yang sama.
  expect(ctx.app.state.transactions.filter((t) => t.id === 'pay-1')).toHaveLength(1);
  expect(ctx.app.state.transactions.length).toBe(before + 1);
  expect(mockInsertDeposit).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'pay-1', transactionId: 'pay-1' }));
});
