import type { Messages } from '../id';

import budget from './budget';
import capture from './capture';
import coach from './coach';
import common from './common';
import domain from './domain';
import home from './home';
import settings from './settings';
import shell from './shell';
import tx from './tx';

export const en: Messages = { common, domain, shell, home, tx, capture, budget, coach, settings };
