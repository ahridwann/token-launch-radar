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

The model is a curve fitted to the snapshot's own traded protocols, never a
hand-picked multiple:

- **Robust fit.** log market cap = a + b·log TVL + g·growth + c·log chains, fitted
  by Huber-robust least squares (k = 1.345, iterated to convergence) over 78 traded
  comps. A comp whose residual is an outlier is downweighted instead of bending the
  curve, so one weird protocol cannot set the price of the whole board.
- **The fitted curve on this snapshot:** log value = 6.51 + 0.58·log TVL +
  0.020·growth − 0.31·log chains. The chain term is negative: holding TVL fixed, a
  protocol spread over twice as many chains trades at about 0.81× the value — and
  the slope holds when the seven comps on more than ten chains are left out entirely.
- **Age was tested — and dropped.** The previous model priced age, but its fitted
  slope flipped sign across comp sets, and dropping it improved every backtest
  number: the leave-one-out median factor from ×1.82 to ×1.75, the share of comps
  inside 2× from 30.8% to 42.3%, the log RMSE from 1.537 to 1.519. Age is still
  shown on every row and still sets the farm plan's hold time — it just does not
  price the token, because the traded protocols say it does not.
- **Category offsets, shrunk.** Each category gets an offset of n/(n+20) from its
  comps' mean residual, for categories with at least three comps: what its traded
  protocols actually trade at, not a fee-capture guess.
- **Winsorized inputs.** Growth is clamped to −50…+150% (null counts as 0), then
  winsorized to the range the comps cover; log chain count is winsorized to the
  comps' chain range the same way. The curve never extrapolates a hot week or a
  wide spread beyond anything a traded protocol did. Log TVL is never winsorized.
- **Honest band.** Every comp is priced again by a fit that never saw it
  (leave-one-out, with bounds, robust fit and offsets all refitted). About 42% of
  the comps land within 2× of their real market cap and half within about ×1.75;
  the fit's R² is 0.33. Each row carries its band — implied value ×/÷ the
  leave-one-out median factor — next to the number.

## The board on this snapshot

- **197 rows ranked:** the 40-protocol watchlist, 19 more above the $50M floor the
  watchlist leaves out, and 138 early finds below the floor. 24 live tokens are set
  aside in their own tab, at the market's own value, never mixed into the ranking.
- **Top of the board:** sentora-curator at about $124.5M implied, then
  steakhouse-financial ($82.8M), usdd ($70.7M), gauntlet ($61.5M) and
  bittensor-dtao ($53.3M).
- **Netted farm plans.** Each of the 197 rows gets seven steps generated from its
  own category, chains, TVL, age and seven-day trend: the capital, the hold time
  and the weekly cadence follow those figures, a growing row gets scale-in advice
  while a shrinking one gets a smaller first deposit until the trend flattens, and
  every step states what it costs and how long it takes. The capital is a deposit
  that comes back on exit, so the detail view nets it: the true cost is the gas,
  shown against the low end of the row's backtest band.

## The dashboard

Open `dashboard/index.html` (with `data.js` beside it) in a browser. No network:
every byte it shows is in `data.js`, and it fetches nothing. Search by name or
slug, filter by category and scope, sort by implied value, TVL, 7-day change, age
or name, page through 25 rows at a time, switch to the Live tokens tab, or click
any row for the model maths, the backtest band, the netted farm cost and the seven
steps to farm it. The address hash deep-links a view
(`#/detail/sentora-curator`, `#/scope/early`, `#/cat/Yield Aggregator`).

## Run it

```sh
# With the sealed snapshot mounted at /input (the grader's container):
node main.ts

# Outside it, point at a snapshot file or directory:
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input path/to/snapshot.json
```

Node 22, standard library only. Deterministic: the same snapshot bytes always
write the same output bytes. The run writes `board.json` (the ranked board),
`data.js` (the dashboard's data), `dashboard/` (the page), `screenshots/` (three
views of the board) and `dossier.json` (built with the vendored make.fun library).

## Verify it

```sh
# Two runs write byte-identical output:
MAKEFUN_OUTPUT_DIR=/tmp/r6a node main.ts --input <snapshot>
MAKEFUN_OUTPUT_DIR=/tmp/r6b node main.ts --input <snapshot>
diff -r /tmp/r6a /tmp/r6b
```

An independent Python reference recomputes the whole pipeline — the robust fit,
the leave-one-out backtest, every row's implied value and band, every plan cost
and every farm step — from the snapshot alone and compares it against
`board.json` field by field.

## What this is not

Nothing here is financial advice, and a launch is never promised. “Records no
token” means the snapshot's record carries no market cap, no CoinGecko id and no
symbol for the protocol — the record, not proof that it has none.

---

Built for the [token-radar-01 bounty](https://make.fun/bounty/token-radar-01) on
make.fun. Referral code: `kc98nxwf`.
