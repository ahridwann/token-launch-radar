# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ahridwann/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ahridwann/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Launch Value Radar is a web dashboard that ranks protocols with no token yet by their estimated launch value, built for the [make.fun token-radar-01 bounty](https://make.fun/bounty/token-radar-01) ("Build the best token launch radar", $1,325 in USDC).

The value model is a size curve fitted to the snapshot's own traded protocols at run time — no protocol names are hardcoded and no coefficient is either. Least squares on log market cap = a + b·log TVL + g·growth + y·age over 78 comps (traded protocols excluding exchange tokens, bridges, liquid-staking and wrapped products, stablecoin products and anchored BTC, and market-cap-to-TVL ratios outside 0.01–10×), with shrunk category offsets and growth/age winsorized to the range the comps cover. On this snapshot: a = 4.89, b = 0.64, R² = 0.31, leave-one-out median error ×1.82, 31% of comps priced within 2×. Each row carries its backtest band (implied ×/÷ ×1.82) and its farm plan netted against gas. The board covers 197 protocols (the 40-protocol watchlist plus 157 more), ranked with #1 Sentora Curator at $154,828,932 of implied launch value. Every row carries 7 concrete farming steps with cost and time estimates, tailored to the protocol's own chain, TVL tier, age and seven-day trend. The dashboard is sortable and filterable, has a per-protocol detail view, and runs with no network.

## Run it

`main.ts` runs on Node 22 with the standard library only. It reads the sealed snapshot (`/input/snapshot.json`, DefiLlama protocol data frozen by the competition) and writes the ranked board to `/output/board.json`, the dashboard data to `/output/data.js`, and a dossier to `/output/dossier.json`. The program is deterministic: the same snapshot bytes always write the same output bytes.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=kc98nxwf&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
