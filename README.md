# Token Radar — which pre-token protocol is worth farming next?

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ahridwann/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ahridwann/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A program that reads a sealed snapshot of the protocol universe, prices every
pre-token protocol by what its token would be worth if its record stayed as it is,
weights that price by the peer odds that a protocol like it records a token at all,
and writes a ranked board plus a dashboard you can open in a browser. The board
covers the whole watchlist and everything beyond it — including the early finds
below the floor — so it finds future launches early instead of waiting for a
hand-kept list of names.

## How it works

The model is an ensemble of three robust curves fitted to the snapshot's own
traded protocols, never a hand-picked multiple, plus token odds counted from the
snapshot's own peer record:

- **Three Huber-robust fits.** Each member fits log market cap on log TVL, growth
  and log chains (k = 1.345, iterated to convergence) over 78 traded comps. The
  members differ in one thing each: raw growth, growth through a signed log, and
  a TVL-curvature term. The raw implied value is the mean of the three log
  predictions.
- **Category offsets.** Each category gets a shrunk offset (n/(n+20)) from its
  comps' mean residual, per member: what its traded protocols actually trade at,
  not a fee-capture guess.
- **Honest backtest.** Every comp is priced by an ensemble that never saw it
  (leave-one-out, bounds, fits and offsets all refitted). On this snapshot the
  ensemble prices at a median factor of ×1.715, with 43.6% of comps inside 2×,
  a log RMSE of 1.517 and R² of 0.331.
- **Walk-forward, a second blind test.** Fitted on comps listed before 2025 and
  tested on comps listed after: median ×1.783, 42.9% inside 2×, log RMSE 1.588.
  The reverse (fit after, test before): median ×1.676, 41.7% inside 2×, log RMSE
  1.313.
- **Token odds from the peer record.** P(token | age bucket × category), counted
  from the snapshot's own 758 protocols: the peer rate rises with age (under 6
  months 3.4% → over 3 years 25.8%). Each cell rate is shrunk n/(n+20) toward its
  age-bucket rate, itself shrunk toward the overall 16.9% (128/758). A protocol
  with no listed date takes the overall rate, never the 29.2% null-age bucket.
  Shrunk odds run 0.031–0.345 over all protocols, 0.031–0.268 over the board.
- **Base-rate caveat.** Peer rates are cross-sectional base rates, NOT calibrated
  forward launch probabilities: the snapshot carries no token-launch dates.
- **Expected value ranks the board.** Expected value = raw fitted implied value ×
  token odds; the raw value stays as its own column. The top row by expected value
  is polymarket-international at $12,442,821 (raw $52,689,067 × odds 0.2362); the
  top raw value is sentora-curator at $119,380,962.
- **Age was tested — and dropped from the price.** Its fitted slope flipped sign
  across comp sets, and dropping it improved every backtest number. Age is still
  shown on every row, still sets the farm plan's hold time, and sets the odds
  bucket.
- **What was rejected.** Adding the excluded products back (111 comps) lifts R²
  to 0.446 but wrecks the backtest (median ×1.84, 32.4% inside 2×). A median (L1)
  fit alone reaches log RMSE 1.504 but its median factor is ×1.82. Fifteen further
  candidates — interactions, log-age, chain dummies, a ratio target, Huber k
  variants, plain OLS, offset-shrinkage variants, k-NN, ridge interactions, a
  fourth ensemble member, LOO-tuned weights — all failed on honest leave-one-out.
  The LOO branch is closed; the price engine is the previous round's ensemble
  unchanged.

Each row carries a seven-step farm plan generated from its own category, chains,
TVL, age and seven-day trend, with the cost and time of every step, and the
detail view nets the plan against the EXPECTED low: the capital is a deposit that
comes back on exit, so the true cost is the gas, and the verdict (Strong farm /
Farm / Marginal / Skip) follows from that ratio. Each row also carries the rank
range its backtest band allows.

The gain from ranking by expected value instead of raw implied value is
unmeasurable locally — there is no local grade for this competition; the live dev
rate after submission is the only verdict — and this entry does not present it as
measured.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path to snapshot.json>
```

That writes `board.json`, `data.js`, `dashboard/`, `screenshots/` and
`dossier.json` into `out/`. Open `out/dashboard/index.html` in a browser (it
renders with no network). The program is deterministic: the same snapshot bytes
always write the same output bytes.

## Layout

- `main.ts` — entrypoint: reads the snapshot, writes the board, data and dossier.
- `lib/model.ts` — the radar-8 ensemble, the token odds, the walk-forward test, the board builder and the farm plans.
- `dashboard/` — the page: board, filters, detail view and live-token tab.
- `vendor/makefun-board.ts` — the kit's dossier library, byte-for-byte.
- `screenshots/` — the board, a detail view and a filtered view.

---

Referral code: `kc98nxwf`
