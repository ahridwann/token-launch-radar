# Token Radar — which pre-token protocol is worth farming next?

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ahridwann/token-launch-radar/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ahridwann/token-launch-radar/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

A program that reads a sealed snapshot of the protocol universe, prices every
pre-token protocol by what its token would be worth if its record stayed as it is,
and writes a ranked board plus a dashboard you can open in a browser. The board
covers the whole watchlist and everything beyond it — including the early finds
below the floor — so it finds future launches early instead of waiting for a
hand-kept list of names.

## How it works

The model is an ensemble of three robust curves fitted to the snapshot's own
traded protocols, never a hand-picked multiple:

- **Three Huber-robust fits.** Each member fits log market cap on log TVL, growth
  and log chains (k = 1.345, iterated to convergence) over 78 traded comps. The
  members differ in one thing each: raw growth, growth through a signed log, and
  a TVL-curvature term. The board takes the mean of the three log predictions.
- **Category offsets.** Each category gets a shrunk offset (n/(n+20)) from its
  comps' mean residual, per member: what its traded protocols actually trade at,
  not a fee-capture guess.
- **Honest backtest.** Every comp is priced by an ensemble that never saw it
  (leave-one-out, bounds, fits and offsets all refitted). On this snapshot the
  ensemble prices at a median factor of ×1.715, with 43.6% of comps inside 2×,
  a log RMSE of 1.517 and R² of 0.331 — better than the previous single-fit model
  (radar-6: ×1.748, 42.3%, 1.519, 0.328) on every backtest number. The gain is
  small, and the dashboard says so: the signal in this snapshot is weak, and
  averaging three honest fits trims the noise instead of inventing a stronger one.
- **Age was tested — and dropped.** Its fitted slope flipped sign across comp
  sets, and dropping it improved every backtest number. Age is still shown on
  every row and still sets the farm plan's hold time.
- **What was rejected.** Adding the excluded products back (111 comps) lifts R²
  to 0.446 but wrecks the backtest (median ×1.84, 32.4% inside 2×). A median (L1)
  fit alone reaches log RMSE 1.504 but its median factor is ×1.82.

Each row carries a seven-step farm plan generated from its own category, chains,
TVL, age and seven-day trend, with the cost and time of every step, and the
detail view nets the plan: the capital is a deposit that comes back on exit, so
the true cost is the gas.

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
- `lib/model.ts` — the radar-7 ensemble, the board builder and the farm plans.
- `dashboard/` — the page: board, filters, detail view and live-token tab.
- `vendor/makefun-board.ts` — the kit's dossier library, byte-for-byte.
- `screenshots/` — the board, a detail view and a filtered view.

---

Referral code: `kc98nxwf`
