# WARZ tokenomics design notes - 2026-07-30

Source material: ethskills.com skill files (concepts, building-blocks, standards - bot-readable Ethereum knowledge base), applied to the verified WARZ token state (see solscan/token/9dF1hj...FQpump and finance-side baseline). Written after the team explicitly ruled out any pump-and-dump-shaped play.

## Current WARZ state (verified on Solscan 2026-07-30)
- WaveWarZ (WARZ), pump.fun launch ~Sep 2025, never graduated
- 90.28% of supply (892.8M) still on the bonding curve (~$2,072 curve value); whole token ~$2,300 implied
- 57 holders, 3,679 transfers. Zaal 27.37M (2.76%, top non-curve holder), treasury 6.18M (0.62%, token creator)
- Zero connection to the platform's real fee engine (0.5% trade + 3% settlement + launch fees)

## The core lesson (ethskills concepts file)
**"Nothing is automatic. Incentives are everything."** Every state transition needs someone with a reason to trigger it. A token is durable only when holding/using it plugs into a self-sustaining incentive loop - Uniswap LPs earn fees so liquidity shows up without anyone asking; Aave liquidators earn bonuses so solvency maintains itself.

Applied here: **WARZ currently has no loop.** Nothing on the platform requires it, rewards it, or routes value through it. Any price movement would be pure attention - which is exactly why "buy + stream" without utility work reads as a pump. The fix is not marketing, it is giving the token a job.

**The encouraging flip side**: WaveWarZ the PLATFORM already passes the incentive-design test remarkably well - artists earn 1% instantly and automatically per trade, winning traders profit from loser pools, claims are permissionless. The product is closer to a "hyperstructure" than most crypto projects. The token is the one un-designed appendage.

## Three legitimate design paths (with honest tradeoffs)

### Path A - Utility token (safest, recommended starting point)
WARZ becomes the platform's action currency:
- Pay battle-launch/queue/skip fees in WARZ (or at a discount vs SOL)
- Artist boosts/promotion slots priced in WARZ
- Community-battle creation gated on holding/spending WARZ
Creates organic buy pressure from real usage. No profit-promise framing - people buy it to DO things, not to earn. This is the standard "consumptive use" structure and the least likely to trip securities analysis (still confirm with Greg/Autonomous - not legal advice).

### Path B - Fee-sharing / staking (bigger draw, bigger legal risk)
Stake WARZ, receive a share of treasury fees. Directly copies the Uniswap-LP flywheel and would give the token real cash-flow value from day one - the platform genuinely earns fees, so this is not vapor. **But**: "hold token, receive profit from the team's efforts" is close to the textbook securities framing (Howey). Given the OKX influencer agreement's compliance posture and the existing YouTube gambling flag, this path needs real legal signoff BEFORE any design work goes public.

### Path C - ve-style governance (Aero/Velodrome model) - later, if ever
Lock WARZ for voting power that directs emissions/fee routing (which battles get boosted, which artists get featured). Powerful flywheel at scale; overkill at 57 holders. Park it.

## Distribution reality - actually a strength
Founders hold only ~3.4% combined (Zaal 2.76% + treasury 0.62%) with 90% still publicly available on the curve. Compare to typical meme launches where insiders hold 20-50%. If the token is relaunched or pushed to graduation, this is a genuinely fair-launch story - but it only stays credible if:
1. Team holdings are disclosed on-stream every time the token is mentioned
2. A public no-sell commitment covers a defined window (wallets are public - verifiable)
3. Any future team allocation is published with vesting before it exists

## The hyperstructure test (design north star)
"Could this run forever with no team behind it?" The battle engine already mostly passes. Token design should aim the same way: fees route to stakers/artists by contract, launch fees burn or recycle by rule, no admin key deciding who gets what. Every discretionary lever is both a centralization risk and a regulatory liability.

## Decision needed before any token work
1. Pick a path (A is the recommended start - cheapest to ship, no legal cliff, real buy pressure)
2. Greg/Autonomous review for whichever path is picked - especially B
3. Decide: revive the existing curve vs fresh launch with published allocations. The existing curve's 90%-public distribution favors revival; the "old dead meme token" optics favor fresh. Either works if disclosure rules above are followed.
4. Only after 1-3: any streaming/promotion plan.

## Learning resources (from ethskills)
- speedrunethereum.com - hands-on challenges; Challenge 2 (Token Vendor) and 4 (DEX) are directly relevant to token+market mechanics
- ethskills.com/standards/SKILL.md - ERC-20/4626 standards if the Base-side (wwbase) deployment ever tokenizes
- defillama.com - live comps for any fee-sharing design
