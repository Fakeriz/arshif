import type { Messages } from '../id';

import auth from './auth';
import billing from './billing';
import budget from './budget';
import plan from './plan';
import capture from './capture';
import coach from './coach';
import common from './common';
import domain from './domain';
import home from './home';
import settings from './settings';
import shell from './shell';
import tx from './tx';

export const ms: Messages = { auth, billing, common, domain, shell, home, tx, capture, budget, plan, coach, settings };
