/**
 * WHICH RPC-SPENDING ENDPOINTS EXIST IN A GIVEN DEPLOYMENT.
 *
 * Zaal ruled "actually restrict the endpoints" on 2026-09-22
 * (`zao-vault/decisions/grill-2026-09-22-seat-afternoon.md`, item 13), over
 * correcting the wording alone. The wording was corrected in #360: these
 * routes never had a same-origin check, only absent CORS headers, which stops
 * another site's JavaScript and stops nothing else. Each request spends a
 * keyed RPC call and the rate limit was per-IP, which does not bound the spend
 * of a determined caller.
 *
 * A TOKEN WOULD NOT HAVE DONE IT. Anything a public web page can obtain, any
 * visitor can obtain: a token minted for our own page is fetchable by whoever
 * asks, so it raises the cost of abuse slightly and bounds nothing.
 *
 * WHAT ACTUALLY WORKS IS THAT THESE ROUTES HAVE NO CALLER TO SERVE. Measured
 * 2026-09-22 on wwtracker.vercel.app: `/widget` and `/operator` are 404 and
 * `/finals` is gated, because WW_WIDGET, WW_OPERATOR and WW_FINALS are unset
 * there. The public battle page renders its trading panel only when
 * `widgetEnabled()`. So every consumer of these endpoints is already absent
 * from the public deployment while the endpoints themselves stayed open. Each
 * one now requires the same flag as the interface it exists for, which costs
 * nothing where the interface is on and closes the spend where it is off.
 *
 * `/api/ww/battle-account` is deliberately NOT here: the public battle page
 * reads it for every visitor, so it has a real anonymous caller. Bounding that
 * one is a caching question, not a gating question.
 */
import { widgetEnabled } from "./widgetFlag";
import { operatorEnabled } from "./operatorFlag";
import { finalsEnabled } from "../finalsFlag";

/** The interface an endpoint exists to serve. */
export type ApiConsumer = "trading" | "operator" | "finals";

export function consumerEnabled(
  consumer: ApiConsumer,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (consumer === "trading") return widgetEnabled(env);
  if (consumer === "operator") return operatorEnabled(env);
  return finalsEnabled(env);
}

/**
 * True when at least one of the named interfaces is on. A route shared by the
 * trade widget and the operator page answers where either is enabled.
 */
export function anyConsumerEnabled(
  consumers: ApiConsumer[],
  env: Record<string, string | undefined> = process.env,
): boolean {
  return consumers.some((c) => consumerEnabled(c, env));
}

/**
 * The 404 a disabled endpoint returns. NOT a 403: a 403 advertises that
 * something is there, which is the same reason `/widget` and `/operator`
 * return 404 rather than a refusal.
 */
export function notFoundResponse(): Response {
  return new Response("not found", { status: 404 });
}
