// GET /api/ww/battle
//
// The battle to show right now: a live one if there is one, otherwise the most
// recent. This is what an arena embeds - the only widget in the registry that
// changes while you are looking at it.
//
// Same failure contract as the rest of /api/ww/*: 200 with a status field.

import { cachedFetch } from "@/lib/wwCache";
import { publicJson, corsPreflight } from "@/lib/wwPublicRoute";
import { findBattle, pickBattle, type RawBattlesResponse } from "@/lib/liveBattle";

// 20s, not the usual 60. A live battle runs about ten minutes, so a minute-old
// pool figure is a meaningful fraction of the whole event. Still one upstream
// call per window however many viewers there are.
const REVALIDATE = 20;
// A LITERAL, BECAUSE NEXT 16 REQUIRES ONE. It will not accept a computed
// value here and says so with an error that names no file. Kept beside its
// constant so the two cannot drift apart silently - if you change REVALIDATE,
// change this. Getting it wrong builds and passes every test.
export const revalidate = 20; // === REVALIDATE

export async function GET(request: Request): Promise<Response> {
  const payload = await cachedFetch<RawBattlesResponse>(
    "battle-current",
    "https://wavewarz.info/api/public/battles?limit=12",
    { revalidateSeconds: REVALIDATE },
  );
  // A battleId is ANSWERED OR REFUSED, never ignored. This route took no
  // parameters, so `?battleId=1789948124` was silently discarded and the
  // caller got the current battle with a 200 - measured 2026-09-22, that
  // request returned 1790046123. Serving it from the response we already
  // fetched costs nothing; when the id is not among those battles we say that
  // rather than hand back a different one.
  const battleId = new URL(request.url).searchParams.get("battleId");
  if (battleId !== null) {
    if (!/^\d{9,12}$/.test(battleId)) {
      // The fetch itself succeeded, so `status` keeps the cache's own word and
      // the refusal rides in `error`, which is the field this contract already
      // has for it. `data` is null rather than a different battle.
      return publicJson({ ...payload, data: null, error: `battleId must be 9 to 12 digits, got ${battleId.slice(0, 20)}` });
    }
    const found = payload.data ? findBattle(payload.data, battleId) : null;
    if (found) return publicJson({ ...payload, data: found });
    return publicJson({
      ...payload,
      data: null,
      error: `battle ${battleId} is not among the most recent battles this endpoint serves, which answers the current or most recent battle. That is not a statement that the battle does not exist.`,
    });
  }
  return publicJson({
    ...payload,
    data: payload.data ? pickBattle(payload.data) : null,
  });
}

export async function OPTIONS(): Promise<Response> {
  return corsPreflight();
}
