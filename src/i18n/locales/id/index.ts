import auth from './auth';
import budget from './budget';
import capture from './capture';
import coach from './coach';
import common from './common';
import domain from './domain';
import home from './home';
import settings from './settings';
import shell from './shell';
import tx from './tx';

/** Katalog sumber (Indonesia). Bahasa lain wajib berbentuk sama persis: dicek TypeScript. */
export const id = { auth, common, domain, shell, home, tx, capture, budget, coach, settings };

export type Messages = typeof id;
