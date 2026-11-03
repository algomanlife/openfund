import {run} from './lib.mjs';
await run(process.execPath,['e2e/test-website-navigation.cjs'],{env:{...process.env,NAVIGATION_PHASE:'routes'}});
