import type { Messages } from '../id';

const budget: Messages['budget'] = {
  title: 'Budget',
  period: '{start} to {end} · {days} days left',
  errorTitle: 'Budget failed to load',
  errorMessage: 'Check your connection and try again. Your data is safe.',
  loading: 'Loading budget',
  adjust: 'Adjust',
  safeToSpend: 'Safe to spend',
  perDay: 'per day',
  untouched: 'No spending this period yet, so your whole budget is still intact.',
  remaining: '{amount} left for needs and wants over {days} days.',
  donutCenter: 'Spent this period',
  donutEmpty: 'No spending this period yet',
  donutCaption: 'Limit {amount} · {pct}%',
  chartHint: 'Log your first transaction to fill this chart.',
  bucket: {
    ofIncomeTarget: 'Target: {pct}% of income',
    ofIncome: '{pct}% of income',
    ofTarget: '{pct}% of target',
    target: 'target {amount}',
    of: 'of {amount}',
    reached: '{label} reached',
    used: '{label} used',
    categoryPct: '{label} {pct} percent',
    empty: 'No spending in this bucket yet.',
  },
  split: {
    title: 'Adjust budget split',
    subtitle: 'Total must be exactly 100%',
    decrease: 'Decrease {label}',
    increase: 'Increase {label}',
    valid: 'Total 100%, ready to save',
    over: 'Total {total}%. Remove {n}% to reach 100%.',
    under: 'Total {total}%. Add {n}% to reach 100%.',
    save: 'Save split',
  },
};

export default budget;
