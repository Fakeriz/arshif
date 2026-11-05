import type { Messages } from '../id';

const shell: Messages['shell'] = {
  tab: { home: 'Home', transactions: 'Activity', budget: 'Budget', coach: 'Coach', assets: 'Assets' },
  assets: { title: 'Assets', subtitle: 'Stocks and other assets', soonTitle: 'Coming soon', soonMessage: 'We are building stocks and other assets. For now, your account balances stay on Home.' },
  capture: {
    title: 'Add transaction',
    subtitle: 'Pick the fastest way for you',
    limitBadge: 'Limit',
    scan: {
      title: 'Scan Receipt',
      short: 'Scan',
      sub: 'Snap a receipt, AI fills it in · {count} scans left',
      sub_one: 'Snap a receipt, AI fills it in · {count} scan left',
      subLimited: 'Scan quota used up this month',
      reason: 'Your Free receipt scans ({free}/month) are used up. They reset on the 1st, or upgrade for {premium} scans/month.',
    },
    voice: {
      title: 'Voice Log',
      short: 'Voice Log',
      sub: 'Say it, it’s logged',
      subLimited: 'Automation quota used up this month',
      reason: 'Your Free automation quota ({free}/month, Voice Log included) is used up. Upgrade for unlimited.',
    },
    pdf: {
      title: 'Import Bank Statement',
      short: 'Import PDF',
      sub: 'PDF from your bank · {count} imports left this month',
      sub_one: 'PDF from your bank · {count} import left this month',
      subLimited: 'Import quota used up this month',
      reason: 'Your Free PDF import ({free}/month) is used. Upgrade for {premium} imports/month.',
    },
    manual: { title: 'Add Manually', short: 'Manual', sub: 'Enter the amount and category yourself' },
  },
  currencySheet: { title: 'Choose currency' },
  notifications: {
    title: 'Notifications',
    unread: '{count} unread',
    allRead: 'All caught up',
    emptyTitle: 'No notifications yet',
    emptyMessage: 'Bill reminders and budget alerts show up here.',
    stateRead: 'Read',
    stateUnread: 'Unread',
    markAll: 'Mark all as read',
  },
  paywall: {
    title: 'Lift the limits with Premium',
    benefitScan: '{premium} receipt scans/month (Free {free})',
    benefitPdf: '{premium} PDF statement imports/month (Free {free})',
    benefitUnlimited: 'Unlimited accounts, goals, and bills',
    benefitVoice: 'Unlimited Voice Log and automation',
    benefitCoach: 'Monthly recap and Ask Coach, 20 questions/day',
    benefitTax: 'Full tax tools and PDF export',
    cta: 'See Premium plans',
    later: 'Not now',
    inactiveTitle: 'Purchases not active yet',
    inactiveMessage: 'Plans and prices appear once RevenueCat is connected in Phase 3.',
  },
};

export default shell;
