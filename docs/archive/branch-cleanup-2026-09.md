# The September 2026 branch cleanup, in one place

Three runs over two days took the remote from **242 heads to 3**. This is the
whole record: what went, why it was safe, and how to get any of it back.

It replaces four dated files that each covered one run - they were accurate and
they were four documents about one subject, which is how a reader ends up
reading three of them and missing the fourth.

**The method, the traps, and why "differs from main" is a useless test, are in
[BRANCH-AUDIT.md](../BRANCH-AUDIT.md).** This file is the ledger.

## The three runs

| Date | Branches | Why safe | Archive |
|---|---|---|---|
| 2026-09-19 | **47** | every tip was an ancestor of `main`; nothing became unreachable | none needed |
| 2026-09-20 | **121** | content on `main`; tips NOT ancestors | `archive/branches-121-2026-09-20.bundle` |
| 2026-09-20 | **80** | 70 carried paths `main` never had | `archive/branches-prune-2026-09-20.bundle` |

**The 47 are the only run that needed no archive.** Their tips were ancestors of
`main`, so deleting the name removed a pointer and nothing else. The later two
are different: a squash-merged branch's own commits never become ancestors, and
a closed branch's never were, so without a bundle their history would go beyond
reach once GitHub collects unreachable objects. That distinction was found by
checking rather than assumed, and it is the reason the bundles exist.

## Getting anything back

```
git fetch archive/branches-121-2026-09-20.bundle 'refs/archive/121/*:refs/heads/*'
git fetch archive/branches-prune-2026-09-20.bundle 'refs/archive/prune/*:refs/heads/*'
```

**Both verified by doing it**, into a fresh `git init`, before and after the
deletions: 121 of 121 and 80 of 80, tip shas matching origin, and
`feat/wave30-appshell-full-stack` restoring with all 155 files.

A first attempt at the 121 bundle recorded `refs/remotes/*` names, which
`git clone` ignores, and restored **zero** branches while the check printed
success anyway - the check was an unconditional `echo`. Both were fixed. **An
archive nobody has restored from is a hope, not a backup.**

## What the scope looked like before any of it

Measured across 191 branches carrying commits `main` lacked:

| Verdict | Branches |
|---|---|
| already-landed - PR merged, commits not ancestors because of squash | 54 |
| superseded - PR closed, every path already on `main` | 67 |
| carried a path `main` had never seen | 70 |

**All 191 merged `main` cleanly - zero conflicts.** And 54 of them looked stale
only because squash-merging never makes a branch's commits ancestors, which is
the trap that once had an audit here reporting 32 stale branches when the answer
was 3.

**52 of the 70 were the July `feat/wave*` series** - one decision, not 52. See
BRANCH-AUDIT.md: 51 of the 53 PRs carrying those components hit Vercel's
free-tier limit of 100 deployments a day, and no hosted preview was ever built
for most of them. Pruning the branch did not discard that work; it is in the
second bundle.

## One correction on the record

`ws/readme-current` was deleted in the 121 run after being named twice as a
branch that would be kept. It is recoverable and was recovered as a check - sha
`9108aa42782b752b97ca444b181b8088d2c516d6`. **The deletion was correct** (it
touched only `README.md`, which is on `main`, and PR #312 superseded its idea);
**the statement that it would be kept was the error.** It had also been used as a
control branch in the 47-run proof, and a control cannot quietly become a
candidate.

---

## Tip shas: the 47 (2026-09-19)

| `ws/components-reason-unrecorded-2026-09-19` | 5 |
| `ws/readme-current` | 1 |
| `chore/battles-refresh-2026-07-28` | `9b5a3c7689d4ca8a10c12ea5e3fbf0dc284bb99f` |
| `chore/validate-all-public-json` | `d2bd5438e76aa41c8b6cdfc880ebdda7b8f14441` |
| `chore/vercel-ignore-doc-builds` | `c86d6e669fc0123df97ef1c9a3906612ee2fbd2d` |
| `docs/community-research-closure-jul17` | `11912736216ef14bca292e90f0ce31eb6031d769` |
| `docs/community-research-dj-wavy-fan-content-2026-07-16` | `f3f6564a2e0acaa64ad101e651070fbc5cd66628` |
| `docs/refresh-battles-stats-runbook` | `ccac5562dccaedc0ea917d8c9b7cd2edd4f2bf1e` |
| `docs/research-doc-refresh-jul29` | `60f24a08b7e6f75e537488e137680515fa161054` |
| `feat/battles-community-tile` | `918ec54a5d5be141c929e4929d3c02a2d09e42c2` |
| `feat/battles-fetch-max-pages-flag` | `76cd713392c0d9123928ddcb35af040e946cd9f0` |
| `feat/case-study-page` | `94037874adfc3420e69c1d2e4aa665c9504ac9f8` |
| `feat/geo-robots-sitemap` | `1e75c6ff10bacc2a99de6b7f3785dba9a0391a11` |
| `feat/json-ld-dataset-schema` | `759d588def56c0b601a8dafaecdcdda1d9e91f90` |
| `feat/local-battles-stats-api` | `84b9f9cf3137fc08ba7a108b92f5141dd9d70492` |
| `feat/overlay-live-battle-stats` | `fae82edb6c84559c2f8c6e08ef5ff6a2ba05a863` |
| `feat/overview-scale-charts` | `59c3c869635258533016896e52af2851691c030d` |
| `feat/platform-growth-monthly-battles` | `c89f606333b0efa43de2a96dc6b4bcdc073bde75` |
| `feat/recap-consolidated-v2` | `1c173d42413add06c6ee6ecb1757cc95523a3072` |
| `feat/speaker-log-consolidated` | `49aad385900bb52b03de8a1f2049b928d02e600b` |
| `feat/stats-api-vitest-smoke` | `895f80bf066b505476b5590b59bcfb7e830342be` |
| `feat/wave28-fixes-freshness` | `1a1402a59824ee7016cdcf944e0ec2fd10c476f4` |
| `feat/wwtracker-llms-txt` | `b04ad001a1b1c613d8d9d926c66259834135ed48` |
| `fix/about-stale-comparison-numbers` | `16e313dcc737691b9e3f5bc5efc8fcc1bbcb6b90` |
| `fix/platform-revenue-optional` | `e2a22b896858e4853e685a5b7dacd91091118dda` |
| `test/suite-consolidated` | `128f820fb2bbd3c41218b1bd7795968bfd3aecbb` |
| `ws/api-factors-polymorphic` | `444ccc4bdeb9aad025703527954767b2920c93fb` |
| `ws/cached-stats-fanout` | `439dac38e76666dfa84c3db73043772d712a4173` |
| `ws/data-refresh` | `31ee0e1dc74061f3b64463bf451f4a5c4aac508e` |
| `ws/docs-ecosystem-sop-2026-09-19` | `4bb07f8217f5d06cdbe6d0d3cf00bff44d51c1ba` |
| `ws/docs-org-front-door` | `edf08158e5ac5c3d59e1ddaf84bcce710687ba35` |
| `ws/drop-cofounder-pnl` | `8f8ff9d5c4aa1f4f4d15358c740a43fcd4318b9b` |
| `ws/fix-price-test-hardcode` | `83a45049ec5ed534499aaeceaf3eb72d03be6d02` |
| `ws/fix-vercel-ignorecommand` | `c9e91200b7c81d96c89308fda644586c99f85b48` |
| `ws/lifecycle-and-visuals` | `d4ab06ec4fa6c1ccd589b52450eac6a7bb40ac63` |
| `ws/livewire-artist-leaderboard` | `cc0d4706517176cd9baae882d197601ac467b58e` |
| `ws/porting-doc` | `d4eafef2b6bc521d2d191ca2b8380c1669cb8757` |
| `ws/resolve-duplicate-stats-endpoints` | `e27296c3569e5d725053dfad4187dbd50ba13cee` |
| `ws/sop7-name-the-file-2026-09-19` | `c8718b8ee2b19e2e95b1b7e2bc71500a83232531` |
| `ws/weekly-revenue-analytics` | `2c762aea36f584c71f5adb83ec61c7474c78389e` |
| `ws/worktrail-audit-2026-09-19` | `c22d8e2c2235ac44a4b6a678523135a3b116136c` |
| `ws/ww-asset-registry-2026-09-18` | `0083bfdf9f3737de5ea8e99328e3875ad2f70f39` |
| `ws/ww-battle-record-2026-09-18` | `1e61fae3e6503c23f900f32de7811b5c6377e18d` |
| `ws/ww-claim-panel-2026-09-18` | `f11cc5f6ab9cd35861e6f9be52c19200a06f6ee1` |
| `ws/ww-claimable-token2022-2026-09-18` | `54a38c71e7f3eaa61eac74e1e44db1842f5b770c` |
| `ws/ww-fresh-quote-2026-09-18` | `1e2a1a859314c3677eb5e6a1f7e3b76d7acb03b9` |
| `ws/ww-price-impact-2026-09-18` | `78274a81c8312501710e18000c491dbf253fc941` |
| `ws/ww-sdk-boundary-2026-09-18` | `4bae0a77face382782552d86ef3c7b016fbc47bd` |
| `ws/ww-token-eligibility-2026-09-18` | `2a09a757a32ae0af3fd1fef7770784bd87df734e` |

## Tip shas: the 121 (2026-09-20)

| Branch | Tip |
|---|---|
| `feat/ai-tournament-page` | `a903f10796a69c5976612c53f0e33f1266a3b13c` |
| `feat/csv-tests` | `85f616ba4d7162883d6cf43fd9f20885d147377f` |
| `feat/lifetime-vol` | `588626ff0a525e4f2f4de6bd9a89220eaf2c828a` |
| `feat/live-overlay` | `a8266ade77969e5cf591736bf447794e4014c04c` |
| `feat/onchain-overview` | `e3c7cdbca1c6436405b79c079c43e6ebaf13d5a4` |
| `feat/price-solana-tests` | `f04dbd3baf65dd721cfcb78c8c0cf9db2835dfdb` |
| `feat/scroll-narrative` | `09558cf3af78a8f549c5141ad8cbee66154b4dba` |
| `fix/audit-jul4` | `e019827ad5e419a668345a37c86387e0eaeeee7d` |
| `fix/freshness-banner` | `68975d8efd4cb136cb4ea6280de4a20114ae2e81` |
| `research/wavewarz-2026-07-15-blocked-network-access` | `a5ff2e3d7170717997096800b84a7ade52754d4e` |
| `research/wavewarz-2026-07-15-community-charity-battle` | `88604ea69eefcda9e9acd339211300055d715479` |
| `research/wavewarz-2026-07-15-community-events-and-fetch-outage` | `564d1f773a0a6f75a4a9c7789d32d432417432f0` |
| `research/wavewarz-2026-07-15-community-events-channels` | `dc448562e3764c69ecb9fbc9b79a639ee0294c37` |
| `research/wavewarz-2026-07-15-community-presence-leads` | `ccc2b34fa9a49edd8d8e89af4776e27c5ac92025` |
| `research/wavewarz-2026-07-15-community-social-presence` | `bb0267be820ee4267bb97e5258c8dd4efb68da9f` |
| `research/wavewarz-2026-07-15-zao-community-link` | `1e83e2d5dd816652d7386b4a0968268e22aff4ee` |
| `ws/artist-tiles-snapshot-label-2026-09-11` | `1c4513de48a3b1780bae2f408713d0b18620592a` |
| `ws/battles-from-public-api` | `b3e01da2241c77dd6224405e33d479943eb256e6` |
| `ws/dune-failed-attempts-2026-09-10` | `2f0ef14d7b98bbd2afde4f1eda1c8ce7253eabcf` |
| `ws/embed-review-2026-09-09` | `98dfeec3ebb8609e442ddc0abc0c8a28aeb071f0` |
| `ws/fee-rate-remaining-surfaces` | `b4e127b1731271308c57bbb9ca8c57e897fa0242` |
| `ws/freshness-from-sources-2026-09-11` | `73c01281fef38c328a09df4ce6626a0ec0fdf954` |
| `ws/grand-final-watch-2026-09-10` | `4e97b4ba66370a2d946a45a0a2fed8cee405664b` |
| `ws/handoff-2026-09-09` | `c5dfc749c20a217dc9cf5823ed2f0bdaabf9ca35` |
| `ws/handoff-head-line` | `5052fccb6a6df6727a70939303abe5828f39aa1f` |
| `ws/launch-fees-out-of-revenue` | `0110d189a0f5263453cd948bc00500ac64f35769` |
| `ws/live-positions` | `4f8b881f0decf58441af9cbd6d68b85287a3b87b` |
| `ws/live-watch-dispatch-loop-2026-09-11` | `d3425f3173db82a78a1dd319e35714f3888c5769` |
| `ws/live-watch-honest-greens-2026-09-11` | `da6708bc5b54d98c6c03b230cf122faf4adcd05b` |
| `ws/measured-constants` | `9fea2441e363344de335b7194b55b3699fe89330` |
| `ws/notify-behaviour-test-2026-09-10` | `4e2de60d7d3fe316516a5944f4d2c83fee2d95f1` |
| `ws/onchain-daily-read-boundary` | `f59563ab56256f81e3e8f07fcb2b63e12cc9656e` |
| `ws/recheck-claims-2026-09-17` | `a59f815004c10ad110a2a2bf328aee35d5d23792` |
| `ws/redact-rpc-source` | `0e5516405a9d2b4f5ac5aab91241903425d11886` |
| `ws/refresh-doc-sol-price-2026-09-10` | `2c7542596d095e1ff5e0a9278eac33a4e8d04487` |
| `ws/retire-songjam-2026-09-10` | `c1dedbfca4ad7f6cc720fc6f40ddd7fb02e95382` |
| `ws/review-followups-2026-09-10` | `0418b444c8abcd5a4d68fdb5bb8165c9bff65ede` |
| `ws/review-followups-280-281-2026-09-11` | `e9d7e29547f17f3d7fd18aa0c54b28355bb33864` |
| `ws/scheduler-cadence-measured-2026-09-12` | `b74ff9a120755bfa67ca92e7ff7bf252c112c1f8` |
| `ws/scheduler-two-models-2026-09-12` | `d14991c622d32f64e9defb87a9626521708028f2` |
| `ws/scheduler-window-measured-2026-09-13` | `a482cc9a18f89ac6a59f027a41b0bc9f8cbaca37` |
| `ws/snapshot-holes-2026-09-10` | `99c85f744753e5d9e6170bc449cfb4bd682c8455` |
| `ws/systematic-sweep` | `773f577c5410fe2b506f15e53e8c624834926d6f` |
| `ws/treasury-tile-honest-2026-09-11` | `bb39b2fa840d45c227e6d9f83cc30d81d6aaacbf` |
| `ws/wavysplit-103-nights` | `cbd74c7fe8996d72e53649a71a14bb76a64bcfff` |
| `ws/ww-ata-create-2026-09-17` | `166a6e496f0b49b34d6fb0b59ca48bf187a98847` |
| `ws/ww-ata-idempotent-fixture-2026-09-17` | `af9b53d1f6d4d33924b0f7f3939a1ad67efee357` |
| `ws/ww-battle-state-2026-09-17` | `3b64e80387ca4c72d8f9be8580292f1dbfd8f73f` |
| `ws/ww-fixture-capture-2026-09-17` | `56f574858b073644f14804242cf69c8b784a6787` |
| `ws/ww-instructions-2026-09-17` | `13beb1641e4504fe71026220334a920078bec09c` |
| `ws/ww-paper-route-2026-09-20` | `adaa30351cbbcab8361db4db60d3d8974c4aac73` |
| `ws/ww-trade-route-2026-09-17` | `b2ffd88895a19850d383a4f280e72e1ecaa505b1` |
| `ws/ww-wallet-2026-09-17` | `3e615b994851d77ceb84cdcc7bc09be2207c4b5c` |
| `ws/ww-widget-ui-2026-09-17` | `b034e54a69ccb468120205a77000909df3c174ab` |
| `chore/battles-refresh-2026-07-17` | `ecdcf0f8df7077bc6aab6cbc3c426509cb300231` |
| `chore/battles-refresh-2026-07-17b` | `6b15c9ab04b3dda687c97c2205c0ea06b73569bd` |
| `chore/battles-refresh-2026-07-17c` | `53fe271db48f19e17c70e7b1d1592d763b573119` |
| `chore/battles-refresh-2026-07-18` | `0341bec874aae72c1aa70711b0bdfaf9a4e90e8d` |
| `chore/battles-refresh-2026-07-25` | `9b67345e325b7ecb640b81133f1835afde26cd3d` |
| `chore/refresh-snapshot-2026-07-16` | `1490b4620902143b94c4ff7c9bfe7e826644b227` |
| `chore/research-log-update-jul17` | `ee7b24c3c54dd13e4b262fc95f264242e5ca2681` |
| `chore/update-sol-usd-price-jul16` | `8009635c03c090b2e2073d3378b8ab6a3e7f2955` |
| `docs/judging-system-research-2026-07-16` | `48f1ea1e60a37a411a7c9f869d560d394ed69e9b` |
| `docs/readme-zao-and-snapshot-annotation` | `d1340068c616c9ab22a6ebe879071cf6326a4c13` |
| `docs/refresh-research-traction-jul2026` | `52a39398a7458e67f0cbc794609d93c7ef5893f3` |
| `docs/research-community-intelligence-section` | `7c3dc902b6dceb14633f540733df365bc76d79c3` |
| `docs/schema-deep-dive-2026-07-16` | `a3d426a76c60dbf51641dfcd17d1e7c8b6c87762` |
| `feat/about-zao-links` | `023729d3d5347c5374ccf985193f89214ab415b7` |
| `feat/add-json-ld-schema` | `6f3c32e19273eba753db440d63e8de61f5eed86f` |
| `feat/add-llms-txt` | `04b8f40cd80d9286f80bc5a30503e2777188ba0f` |
| `feat/artist-battle-history` | `36ddf882c2d89b692acdfcf00ca99be054d1ea6a` |
| `feat/artist-page-generate-metadata` | `d2cfea6789e27512c4fe3d575964aad3e83f64de` |
| `feat/artist-page-notes` | `1845de09b451c53a6151342e68ff73ce9375324d` |
| `feat/artists-ww-battle-stats` | `79d4d21f32f8f37a66fafe33849f845b0a536b91` |
| `feat/ecosystem-zao-dao-context` | `5c615378486ee06cee03169078b3981f9296765e` |
| `feat/events-live-battle-counts` | `087460e7a26713a618170b4b64bce12f5843e0be` |
| `feat/events-third-party-coverage` | `fd8abaa8955189182fe4374b6650da366f63addf` |
| `feat/events-upcoming-zaostock` | `a5ce61d590dc51317cf903228857bd43f0210acc` |
| `feat/events-zaostock-upcoming` | `821806350ad6ce57528d6a7f05bc2f948fd03cc9` |
| `feat/faq-clippers-program` | `20f6b8c18592246b99a83480890c27a4cc44622f` |
| `feat/faq-consolidated` | `8bd1a9a347e54f37f3023c5a5ead2eefd6bc3ba0` |
| `feat/faq-how-to-become-artist` | `e6d7346f908e5cc947e569007829902080735ea8` |
| `feat/faq-tournaments-and-ai-artist` | `9471f5d0adce116214a0f50125dd7c36da821f88` |
| `feat/faq-zao-and-djwavy` | `a18e369aace3b9afd78c88f432c544b0271c0d20` |
| `feat/faq-zaoos-governance` | `5e92391ea5054a81315439807eec3f0c23d916b8` |
| `feat/helius-battle-decode-v2` | `9252e245d0f67438e1740e4e375811ababbe79da` |
| `feat/helius-battle-decode-v3` | `c0004a068e115cf6cfc7f84595ff4787df57deb5` |
| `feat/leaderboard-search-sort` | `21a562bdfcefb3988801d62b6ef4e8383a90b039` |
| `feat/metadata-zao-mention` | `eb911d252ab3a79bb96f770fd2e9b3b8ce433f15` |
| `feat/recap-artist-win-rate` | `e16fc7fc511eaabe9f7d8548a600e8eb1cb2764f` |
| `feat/recap-closest-margin-in-draft-v2` | `e7668a5be1281c4ce199382ba6a3cb9df39be80d` |
| `feat/recap-dry-run` | `6ce596cb375274ab85e031dc9918b8b8846ae7d9` |
| `feat/recap-main-count-in-draft` | `5796ad5f50c32965494fb2149232b860d4bd3467` |
| `feat/recap-winner-in-weekly` | `2ecafb6fabd2bf5c9ddf970e2d915fd1a2b670a3` |
| `feat/roster-add-frameworkfortune` | `263fc779e7ce000c2cb8b122ed7aeeaa37602f3a` |
| `feat/songs-audius-track-ids` | `1567567a756c4dd634e9dff7dc3468e7da13d38d` |
| `feat/speaker-log-builder` | `6c90249f0927235ca9b2047f7d74e2d9fc0e82f9` |
| `feat/speaker-log-cli` | `4f6cf545714b86779e9ff06f295b362d0c3ca66e` |
| `feat/speaker-log-docs` | `09a7b0c37b1698706fceccc6d45eb08c8d79cc75` |
| `feat/speaker-log-parser` | `44dcd135eb8524bbe1e85cb47aeb588d57a1e502` |
| `feat/speaker-log-resolver` | `67844778324471ede6cc92fca8a73d7eb116355a` |
| `feat/wave26-events-artist-notes` | `4d5d7f32bf85fade5bdf3e17c7e8935ab78c6095` |
| `feat/wave27-artist-faq-leaderboard` | `9574d1e7e3bdd71ec2eadf997fc201ce0737c965` |
| `feat/wave29-content-fixes` | `e28b7e91a22827cce24ec3c3a96ab96ed1fdb0f3` |
| `fix/artist-page-handle-resolution` | `c3414ee64a5841266efe8989f350a86556515781` |
| `fix/audius-dead-discovery-node-fallback` | `32502344ea211f882352573354c555fcf7b03d80` |
| `fix/battle-parser-inner-quotes` | `985a4f93bbe92f855d59505d2ae03bedd677ecee` |
| `fix/events-charity-section-dates` | `2395636e6511fd0fe8dbcdc16d5f7a4d2f94ad63` |
| `fix/howit-appshell-floor-sol` | `e0136a5cc901aba739b845f4ed32b0b147cb33ca` |
| `fix/leaderboard-audius-handle-map` | `e71bcdecbfffb1269deaec42f69eab41299ed80f` |
| `fix/onchain-proof-hardcoded-values` | `7032dd50d91beff03dedfd6d0fed37ab0a6adf35` |
| `fix/platform-analytics-stale-numbers` | `e3a336d205d6a59a7ee433f190d6c345199aeb6a` |
| `fix/recent-battle-community-type` | `94826174e968bd1917f7491ceb339d234d168895` |
| `fix/snapshot-dates-use-freshness` | `57ce25e6329a1f33c9adb39c7b325eac6db1c9d6` |
| `fix/traderscorecard-config-constants` | `b3a2b2231f1bbafa642747c7aeaf8eb21a7698a0` |
| `test/artists-and-songs-contract` | `36f54fb7180749457de734ee8fd3cecfa445727b` |
| `test/freshness-and-battles-contract` | `96b7470a33e3e7ae723ae75a70a667e71745afb0` |
| `test/leaderboard-and-traders-contract` | `6cc38152d0b77dc2e703bb11da67ec625476fbff` |
| `test/solana-address-validation` | `e97123c1479c45879b7a20333e620a2379e633af` |
| `test/wwdata-snapshot-contract` | `ebfefed4401a6a6d853dcc08113b6d179476ab02` |
| `ws/readme-current` | `9108aa42782b752b97ca444b181b8088d2c516d6` |

## Tip shas: the final 80 (2026-09-20)

| Branch | Adds new paths | PR | Tip |
|---|---|---|---|
| `chore/battles-refresh-2026-07-23` | 1 | CLOSED:185 | `4e5962ba6b12540112c170046d838ae163656d82` |
| `chore/battles-refresh-2026-07-24` | 1 | CLOSED:188 | `2d046e3aa382fb56ad5231444865635f7d745e12` |
| `chore/research-docs-consolidated-jul17` | 2 | CLOSED:169 | `711a1cb87b074255c7323a6ec2993b8852a3dd53` |
| `docs/community-followup-verified-2026-07` | 1 | CLOSED:137 | `fac7b55c0a58de96a0da8836a0f44678e67e951c` |
| `docs/community-research-charity-farcaster-jul16` | 1 | CLOSED:83 | `66a63c7cf43cb6ea0ce1ed30a229f3a33cefa92f` |
| `docs/community-research-followup-2026-07-16` | 1 | CLOSED:41 | `610aed2508352a529af580d6d8466262228a2a71` |
| `docs/community-research-jul17-verified` | 1 | CLOSED:77 | `98aaebc5b9b4d165a5853aaab56d113f75c09b5c` |
| `docs/stats-api-hurricane-handoff` | 1 | CLOSED:136 | `485d960852ee3de4b3e706f542adf420b11c2304` |
| `docs/stats-api-hurricane-handoff-v2` | 1 | CLOSED:187 | `9ec73b4d527e0c0b7b2610a18581186fa45017c0` |
| `feat/add-robots-and-sitemap` | 1 | CLOSED:88 | `11c716bae90c8887868c1acada9a69c058ae8c54` |
| `feat/artist-earnings-estimate` | 1 | CLOSED:106 | `12fa362b5909dccd61c1cff9eea56e425a2ee09e` |
| `feat/artist-profile-deep-dive` | 1 | CLOSED:117 | `42f8b6bce6da831f46357b1e543a83820e19e5fd` |
| `feat/artist-standings` | 21 | CLOSED:121 | `ac68ee58f4063f005af2dd065109e03097e025b5` |
| `feat/artist-winrate` | 1 | CLOSED:132 | `2607d1758561c6cb6e1a32bf6bcbdc07dd120eb1` |
| `feat/battle-activity-calendar` | 1 | CLOSED:111 | `2d0d3174c7abff6a8aa21ddc4b0cf598b0c8794f` |
| `feat/battle-arena-rankings` | 1 | CLOSED:92 | `50748d2236b128308ae68d46d49e4b99ffeafdf1` |
| `feat/battle-type-breakdown` | 1 | CLOSED:114 | `bf456c5f1a770b996b014ee0f900098a7b31ae36` |
| `feat/battles-section-consolidated` | 5 | CLOSED:109 | `d72e8f6908cd999b68bf821691f293439b892189` |
| `feat/battles-section-mega-consolidated` | 13 | CLOSED:119 | `29801fdbc9b3aea228936f667579ddede8d38d21` |
| `feat/biggest-battles` | 1 | CLOSED:100 | `bf82ee97f39089096620f47948efc1ea8a69a0dc` |
| `feat/community-verified-follow-up` | 1 | CLOSED:130 | `3eee0d42307586a66b588d1bd92efa7bf2e1365b` |
| `feat/dow-activity-chart` | 1 | CLOSED:113 | `2af45bd8ac7a11ac101e421b48134deea99b1e7f` |
| `feat/economics-breakdown` | 1 | CLOSED:142 | `328360683f208ef0f7f9ea9544f2c13e14e89c54` |
| `feat/ecosystem-section-consolidated` | 4 | CLOSED:110 | `4c69659486d8cde19fddfc9afa62530b2d25f9f6` |
| `feat/fractal-governance-wave8` | 5 | CLOSED:144 | `f21d0debc25b8ba34d693c952a987abe389ef709` |
| `feat/growth-momentum` | 2 | CLOSED:139 | `e7f5ecdbefd6eff34c99bf650f2c9264996c61c3` |
| `feat/handle-h2h-lookup` | 1 | CLOSED:112 | `5a29a3ad8ea8533294b9b9de4e1f0f1093dba22c` |
| `feat/helius-battle-decode` | 1 | CLOSED:40 | `01e77c7eb8067b8f60c8e2a182af2392bd0e56e8` |
| `feat/hot-streaks` | 1 | CLOSED:131 | `ffdc0977005d5b35b61ad2685d81ba81864e61dc` |
| `feat/ip-highlights-wave9` | 6 | CLOSED:147 | `3184d5a232f6586fd64fa1062dcb37b6164dd7e6` |
| `feat/live-battle-banner` | 1 | CLOSED:52 | `7581a530ba48f0694827d140dc97a5a5e46ba500` |
| `feat/live-ticker-bar` | 1 | CLOSED:97 | `887d08440d59ecd924f910de619e421d9a09a4aa` |
| `feat/margin-distribution` | 1 | CLOSED:115 | `9a95886ca239f67ae7129e9ffe8bef093fe3bd1a` |
| `feat/milestones-timeline` | 15 | CLOSED:123 | `ab8e7df53338e3333ed7ec2787b024272a4ffd70` |
| `feat/monthly-volume-chart` | 1 | CLOSED:116 | `b3d41c3739c64e240cda49eb8fd0dcf2428cfd47` |
| `feat/platform-pulse` | 17 | CLOSED:122 | `df541ceb3cc51a4e719c7fb698a53b1b39262cdb` |
| `feat/platform-summary` | 1 | CLOSED:141 | `62c34cfc4224aad703939565c5f4a88546baaee3` |
| `feat/recent-battles-feed` | 2 | CLOSED:103 | `329bb708d535ecba8721ee2bb85fc27dd1810418` |
| `feat/recent-standings` | 3 | CLOSED:108 | `bc924ad676050d479e1f615baf710f7c0f67d419` |
| `feat/revenue-floor-wave10` | 1 | CLOSED:148 | `b78d60a7d9f3e9c02c4923d443868dddff53c96c` |
| `feat/rivalry-board` | 1 | CLOSED:99 | `e46a368e607afdc9c1d70c524eb53d5d4f45f9a7` |
| `feat/song-arena-rankings` | 5 | CLOSED:93 | `1d2f0cd6e9c41316c497873d0ed0d6c9d8fba4ab` |
| `feat/song-records` | 1 | CLOSED:120 | `065d724d3b436b7bf31fad3b8e5a8ed6ea53ce55` |
| `feat/song-rematches` | 17 | CLOSED:124 | `2bfef26ee72d4961fdb709b480d3410264e8df93` |
| `feat/stats-api-doc` | 3 | CLOSED:104 | `6b1e6f000ed4d09b5797736c32d6f9b1c8a67945` |
| `feat/traders-analytics-wave3` | 4 | CLOSED:135 | `72da500c941d02d8028fc89b6eea099f6c11eebf` |
| `feat/wave12-trader-activity` | 7 | CLOSED:150 | `065a5608a799107f7248d1722ff899348ff40d81` |
| `feat/wave13-cumulative-growth` | 3 | CLOSED:151 | `51543b3901811da5b426e7420432ba0332f4a690` |
| `feat/wave14-distributable-now` | 5 | CLOSED:152 | `c2e53bf1d37f2e4fc08410961e6194f7bfbeb953` |
| `feat/wave15-revenue-curve` | 3 | CLOSED:153 | `4b748623deba66bb69550e62eb2570ec20208ab2` |
| `feat/wave16-live-battle-types` | 5 | CLOSED:154 | `c91a8b8a317b9e5ad1e7b7f84f680414a75e4685` |
| `feat/wave17-growth-stack` | 3 | CLOSED:155 | `c5beacca231b5296d17bf6f5a36c72a2eaa9ba63` |
| `feat/wave18-section01-02-stack` | 2 | CLOSED:156 | `eb572e2e422cf27182b676724a6c4865a9e286d1` |
| `feat/wave19-section04-stack` | 3 | CLOSED:157 | `6d4bc25edfbefd44016f9389a5588471c13218f1` |
| `feat/wave20-section07-stack` | 7 | CLOSED:158 | `a1468e07445ddea8470bbf6c76269dacf95bd41c` |
| `feat/wave21-section09-stack` | 6 | CLOSED:159 | `e41c643facc0fad7b2930932b85bbaedc6f0fad8` |
| `feat/wave22-section06-stack` | 13 | CLOSED:160 | `893aca6e0b496cee863b9d8cb87aea6cc5ed108b` |
| `feat/wave23-section08-stack` | 4 | CLOSED:161 | `fc97fb13c507d352c12fce3118f0e3bdac65128e` |
| `feat/wave24-section00-platform-summary` | 1 | CLOSED:162 | `d57ac206f73821b655183301556eba6f1fe0b626` |
| `feat/wave25-live-platform-features` | 4 | CLOSED:166 | `bdc3a2abdfac270b31fdf7b3b5da635da992915d` |
| `feat/wave30-appshell-full-stack` | 45 | CLOSED:174 | `d6e6a95601cfe0cf0cfe96e92477b64a3ddb6a6a` |
| `feat/ww-community-media` | 2 | CLOSED:107 | `94010f9e85751ae9a615fc933e52b210836007d3` |
| `feat/wwnow-wave11` | 2 | CLOSED:149 | `667ead551f70fce2271e583986ae2ec072ac17d8` |
| `feat/zao-ip-summary` | 4 | CLOSED:140 | `e195cc99be0af8e6545dcf7a46786c586aea93b3` |
| `feat/zao-vitals-card` | 1 | CLOSED:89 | `5a21d86cf648e5b8d65995a5f9a4638eeadfdedd` |
| `recap/weekly-2026-07-17` | 1 | CLOSED:164 | `6b7734cde306915f291a45582a4999d5fae2b8b6` |
| `recap/weekly-2026-07-24` | 2 | CLOSED:189 | `5f181892cb51ea647b155e2bf7f9e1320766e8ac` |
| `recap/weekly-2026-07-28` | 1 | CLOSED:195 | `84b2384f706018c2663ff5e803cc2dc105d1e2eb` |
| `rescue/1e49540-soltracker-main` | 3 | none | `1e495406b1321cc40aff034c5d5311b1bba600d9` |
| `stats-api-doc-and-smoke-test` | 2 | CLOSED:38 | `499ae0921f326082842264635b20ad44e85ea658` |
| `ws/components-reason-unrecorded-2026-09-19` | 0 | MERGED:310 | `f1048a03456845f239ff38da3a542dfc76a78922` |
| `ws/deletable-branch-record-2026-09-19` | 0 | MERGED:311 | `3e942fefbcca3b2c7184c7c529bcf18cb462e350` |
| `ws/grill-fixes-2026-09-19` | 0 | MERGED:309 | `da81fcbc503483d7e8465c8272c56ceec324f7fb` |
| `ws/readme-freshness-current-2026-09-19` | 0 | MERGED:312 | `bf681fafb3c81593c4da06969904fa86b511d87c` |
| `ws/readme-volume-bug-unheld-2026-09-20` | 0 | MERGED:318 | `b5df6bb39dc3284481f37e4105bd4d4cbc82c233` |
| `ws/upstream-api-audit-2026-09-20` | 0 | MERGED:317 | `d6bd58a5fb01dc5f714d6175eaba1ced921509f2` |
| `ws/upstream-volume-note-2026-09-19` | 0 | MERGED:313 | `005d93fe8ccb762ea6bc90972936ab0aa5a6ed1f` |
| `ws/wavewarz-graduated-from-zao-2026-09-20` | 0 | MERGED:316 | `169c0a9198f596940cff410b2b369f2dfe1d7e3d` |
| `ws/ww-battle-verification-2026-09-19` | 0 | MERGED:314 | `ae2b877327fe532e2b0d18e788cc8366bd01c20a` |
| `ws/ww-quote-sell-fee-2026-09-19` | 0 | MERGED:315 | `72df9d61e1d34f87b50cb9875e17fc8bd21094e1` |
