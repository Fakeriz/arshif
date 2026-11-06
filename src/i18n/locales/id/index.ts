import acct from './acct';
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
import slog from './slog';
import inv from './inv';
import tools from './tools';
import tx from './tx';

/** Katalog sumber (Indonesia). Bahasa lain wajib berbentuk sama persis: dicek TypeScript. */
export const id = { acct, auth, billing, common, domain, shell, home, tx, capture, budget, plan, coach, settings, slog, inv, tools };

export type Messages = typeof id;
