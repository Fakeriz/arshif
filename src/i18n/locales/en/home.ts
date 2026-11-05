import type { Messages } from '../id';

const home: Messages['home'] = {
  profileA11y: 'Profile and settings',
  notifA11y: 'Notifications',
  notifUnreadA11y: 'Notifications, {count} unread',
  netWorth: 'Total net worth',
  showBalance: 'Show balance',
  hideBalance: 'Hide balance',
  balanceMeta: '{count} accounts · converted to {currency} · sample rates {date}',
  balanceMeta_one: '{count} account · converted to {currency} · sample rates {date}',
  sampleData: 'Sample data',
  accountLimitA11y: '4-account limit reached. Open Premium to add accounts',
  accountLimitReason: 'The Free plan allows 4 accounts and wallets. Premium has no limit.',
  cardPosition: 'Card {n} of {total}',
  accountLimitTitle: '4-account limit reached',
  accountLimitSub: 'Go Premium to add accounts',
  recapTitle: 'Your weekly recap is ready',
  recapMessage: 'See where your money went last week.',
  budget: {
    title: 'This period’s budget',
    a11y: 'This period’s budget, {pace}. Safe to spend {amount} per day. Open Budget',
    period: '{start} to {end} · {count} days left',
    period_one: '{start} to {end} · {count} day left',
    safe: 'Safe to spend',
    perDay: 'per day',
    usageA11y: 'Needs and wants budget used',
    usage: '{spent} of {limit} for needs and wants',
  },
  health: {
    title: 'Financial health',
    openCoach: '{label}. Open Coach',
  },
  recent: {
    title: 'Recent transactions',
    seeAll: 'See all',
    emptyTitle: 'No transactions yet',
    emptyMessage: 'Snap a receipt or say what you spent, logged in 10 seconds.',
    emptyAction: 'Add one now',
    accountFallback: 'Account',
  },
  error: {
    title: 'Home couldn’t load',
    message: 'Check your connection and try again. Your data is safe.',
  },
};

export default home;
