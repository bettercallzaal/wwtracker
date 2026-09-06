import json,time,collections
exec(open('/tmp/verify.py').read().split('OFF=')[0])
TREASURY="FNjYtwKVsbQzSmoBgLqa8ZGSJTzexQJi6xmV97iakq37"
QUICK, COMMUNITY = 0.69, 4.0

rows=json.load(open("/tmp/battles.json"))
sample=rows[:20]
buckets=collections.Counter(); amounts=[]; checked=0
for r in sample:
    bid=r["battleId"]; addr,_=find_pda([b"battle", bid.to_bytes(8,"little")])
    try:
        sigs=rpc("getSignaturesForAddress",[addr,{"limit":60}])
        init=None
        for s in reversed(sigs):
            tx=rpc("getTransaction",[s["signature"],{"maxSupportedTransactionVersion":0,"encoding":"json"}])
            if tx and any("Instruction: InitializeBattle" in l for l in tx["meta"].get("logMessages",[])):
                init=tx; break
        if not init: continue
        checked+=1
        keys=init["transaction"]["message"]["accountKeys"]
        pre,post=init["meta"]["preBalances"],init["meta"]["postBalances"]
        # net lamport change for the treasury inside the creation transaction
        delta=0.0
        if TREASURY in keys:
            i=keys.index(TREASURY)
            delta=(post[i]-pre[i])/1e9
        amounts.append((bid,delta))
        if abs(delta-QUICK)<0.02:      buckets["quick 0.69"]+=1
        elif abs(delta-COMMUNITY)<0.05: buckets["community 4.0"]+=1
        elif delta>0.001:               buckets["other inflow"]+=1
        elif delta<-0.001:              buckets["treasury PAID"]+=1
        else:                           buckets["no movement"]+=1
    except Exception:
        pass
    time.sleep(0.15)

print(f"battle-creation transactions inspected: {checked}\n")
print("treasury lamport change inside the InitializeBattle transaction:")
for k,v in buckets.most_common(): print(f"   {v:3d}  {k}")
print("\nsample of actual deltas (SOL):")
for bid,d in amounts[:12]: print(f"   {bid}  {d:+.6f}")
nz=[d for _,d in amounts if abs(d)>0.001]
print(f"\nnon-zero movements: {len(nz)}/{len(amounts)}")
if nz: print(f"   min {min(nz):+.6f}  max {max(nz):+.6f}")
