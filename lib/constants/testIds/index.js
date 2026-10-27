// Central registry of data-testid values used by the end-to-end testing agent.
// Each feature lives in its own file and is re-exported from here.
// To add a feature: create constants/testIds/<feature>.js, export a named
// object, then add `export * from './<feature>';` below.

export * from './auth';
export * from './home';
