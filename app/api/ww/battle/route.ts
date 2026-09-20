// GET /api/ww/battle
//
// The battle to show right now: a live one if there is one, otherwise the most
// recent. This is what an arena embeds - the only widget in the registry that
// changes while you are looking at it.
//
// Same failure contract as the rest of /api/ww/*: 200 with a status field.

import { cachedFetch } from "@/lib/wwCache";
import { publicJson, corsPreflight } from "@/lib/wwPublicRoute";
import { pickBattle, type RawBattlesResponse } from "@/lib/liveBattle";

// 20s, not the usual 60. A live battle runs about ten minutes, so a minute-old
// pool figure is a meaningful fraction of the whole event. Still one upstream
// call per window however many viewers there are.
const REVALIDATE = 20;
// A LITERAL, BECAUSE NEXT 16 REQUIRES ONE. It will not accept a computed
// value here and says so with an error that names no file. Kept beside its
// constant so the two cannot drift apart silently - if you change REVALIDATE,
// change this. Getting it wrong builds and passes every test.
export const revalidate = 20; // === REVALIDATE

export async function GET(): Promise<Response> {
  const payload = await cachedFetch<RawBattlesResponse>(
    "battle-current",
    "https://wavewarz.info/api/public/battles?limit=12",
    { revalidateSeconds: REVALIDATE },
  );
  return publicJson({
    ...payload,
    data: payload.data ? pickBattle(payload.data) : null,
  });
}

export async function OPTIONS(): Promise<Response> {
  return corsPreflight();
}
