# token-launch-radar

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ahridwann/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ahridwann/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Launch Value Radar is a web dashboard that ranks protocols with no token yet by their estimated launch value, built for the [make.fun token-radar-01 bounty](https://make.fun/bounty/token-radar-01) ("Build the best token launch radar", $1,325 in USDC).

The value model is derived from the snapshot's own figures — no protocol names are hardcoded. Each protocol's implied launch value is `TVL × 0.30 × growth × maturity × category × chains`, where growth is its 7-day TVL change, maturity grows with how long it has run with no token, category is a fee-capture tier from the category string only (1.15 direct fee earners, 1.08 allocators and yield-bearing assets, 1.00 neutral, 0.92 infrastructure), and chains adds 2% per chain up to five. The board covers 197 protocols (the 40-protocol watchlist plus 157 more), ranked with #1 Steakhouse Financial at ~$858,140,887 of implied launch value. Every row carries 7 concrete farming steps with cost and time estimates, tailored to the protocol's own chain, TVL tier, age and seven-day trend. The dashboard is sortable and filterable, has a per-protocol detail view, and runs with no network.

## Run it

`main.ts` runs on Node 22 with the standard library only. It reads the sealed snapshot (`/input/snapshot.json`, DefiLlama protocol data frozen by the competition) and writes the ranked board to `/output/board.json`, the dashboard data to `/output/data.js`, and a dossier to `/output/dossier.json`. The program is deterministic: the same snapshot bytes always write the same output bytes.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=kc98nxwf&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
