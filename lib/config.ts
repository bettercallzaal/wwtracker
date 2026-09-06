// WaveWarZ on-chain constants - single source of truth. Every component
// should import these instead of redefining the address strings locally.
export const PROGRAM_ID = "9TUfEHvk5fN5vogtQyrefgNqzKy2Bqb4nWVhSFUg2fYo";
export const TREASURY_WALLET = "FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37";
/**
 * NOT only a trader. Verified 2026-09-06: this wallet is the fee payer of the
 * InitializeBattle instruction on battle 1788580997, so it creates battles as
 * well as trading them. Anything that treats it as a pure trader is wrong.
 * See wavewarz-protocol/spec/OPERATOR.md.
 */
export const TRACKED_TRADER_WALLET = "4aY165b2vWGLWTboE9WQSW6BprcVAs2WJo5E4jhvW1Bk";

/** Treasury operating floor in SOL - founders skim excess above this back down. */
export const FLOOR_SOL = 3.5;
