// Traders data is now live via /api/ww/leaderboards/traders, fetched by components/Traders.tsx
// at runtime from the cached fan-out route.

import { TRACKED_TRADER_WALLET, TREASURY_WALLET } from "./config";

export const ME_WALLET = TRACKED_TRADER_WALLET;
export { TREASURY_WALLET };
