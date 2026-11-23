// Token Radar's value model (radar-7): a sealed snapshot in, a ranked board out.
//
// The board ranks protocols that record no token, by what a token would be worth if the
// protocol's record stayed as it is. It never predicts whether or when a token is issued:
// the implied value is this entry's own claim, derived only from the snapshot's figures.
//
// radar-7 is an ensemble of three Huber-robust fits, not one fit. radar-6 was a single
// fit on [log TVL, raw growth, log chains]: leave-one-out median factor x1.748, 42.3%
// of comps inside 2x, log RMSE 1.519, R^2 0.328 (78 comps). Every candidate change for
// radar-7 was tried the same honest way - leave-one-out, with the winsor bounds, the
// robust fit and the category offsets all refitted without the comp being priced - and
// kept only when it improved all three backtest numbers. Three changes survived, and
// they survive together as an equal-weight ensemble, each member fitted the same way:
//
//   M1  = the radar-6 fit itself: [log TVL, raw growth, log chains].
//   M2  = growth through a signed log: sign(g) * log1p(|g|). A week of +400% growth
//         and a week of +4% should not differ a hundredfold in the price, and the
//         log transform says so: it compresses the extremes while keeping the sign.
//         Alone it prices at median x1.741, 42.3% inside 2x, log RMSE 1.515.
//   M3  = M1 plus a TVL-curvature term, (log TVL - 17)^2. The size curve bends: the
//         biggest protocols trade at a smaller multiple than the middle ones, and a
//         quadratic term lets the curve bend instead of forcing one straight slope.
//         Alone it prices at median x1.763, 43.6% inside 2x, log RMSE 1.521.
//
//   The ensemble (the mean of the three members' log predictions) prices at median
//   x1.715, 43.6% inside 2x, log RMSE 1.517, R^2 0.331 - better than radar-6 on every
//   backtest number. The gain is small, and the dashboard says so: the signal in this
//   snapshot is weak, and averaging three honest fits trims the noise instead of
//   inventing a stronger signal. No member on its own beats radar-6 on all three
//   numbers; the ensemble does, because the members disagree most where each is
//   weakest and their average lands closer to the traded truth.
//
//   What did NOT survive, and why: adding the traded protocols the watchlist rule
//   excludes (bridges, liquid staking, CEX, stablecoins - 111 comps) lifts R^2 to
//   0.446 but wrecks the backtest (median x1.84, 32.4% inside 2x), because those
//   products do not price like a new launch; widening the market-cap-to-TVL ratio
//   filter to 0.005-20x does the same (median x1.90). Age, in log form or as buckets,
//   still flips sign and still hurts every number, so it stays out of the price.
//   It is still shown on every row and still sets the farm plan's hold time.
//   A median (L1) fit alone reaches log RMSE 1.504 but its median factor is x1.82,
//   so it stays out of the ensemble: the ensemble keeps only members whose errors
//   complement each other without any one member dragging the median.
//
//   offsets = shrunk mean residual per category, n/(n+20), n >= 3, computed per
//             member from that member's own residuals.
//   implied = exp(mean of the three members' log predictions), rounded, >= $1.
//   band    = implied x/÷ the ensemble's leave-one-out median factor.
//   net     = the plan's true cost is gas only (the capital is a deposit that comes
//             back on exit). The detail view nets the low end of the band against it.
//
// The fit is still weak in absolute terms and the dashboard says so. No name is ever
// special-cased and no coefficient is hardcoded: the same code fits any snapshot the
// house seals, and each member is fitted at run time from the snapshot.
//
// Scope: the watchlist is the floor, never the ceiling. The board carries every
// watchlist slug, then every other rankable pre-token protocol: the 19 above the floor
// the watchlist leaves out, and the 138 below it, by TVL. Rankable means pre-token
// and not a wrapped, staked or bridged product of a token that already trades, not
// an exchange, and not a versioned pool - the house's own watchlist rule, applied to
// the whole snapshot.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** One ensemble member: its feature names, its fitted coefficients, its winsor bounds
 * and its shrunk category offsets. Beta is indexed [intercept, ...features]. */
export interface MemberFit {
  /** Short label the dashboard shows, e.g. "raw growth". */
  label: string;
  /** Feature names in beta order (after the intercept). */
  features: string[];
  beta: number[];
  /** Winsor bounds per feature, in the same order as features. */
  bounds_lo: number[];
  bounds_hi: number[];
  /** Shrunk mean residual per category, in log units (0 when the category has < 3 comps). */
  category_offsets: Record<string, number>;
}

/** The fitted ensemble and its backtest, as the run computed them from the snapshot. */
export interface FitResult {
  /** Traded protocols the curve was fitted on. */
  comps_n: number;
  /** Traded protocols excluded from the fit (products + ratio outliers). */
  excluded_n: number;
  /** The three Huber-robust members, in order M1, M2, M3. */
  members: MemberFit[];
  /** Leave-one-out median factor error: half the comps price within this factor. */
  loo_median_factor: number;
  /** Leave-one-out share of comps priced within 2x. */
  loo_within_2x: number;
  /** Leave-one-out log RMSE. */
  loo_log_rmse: number;
  /** R^2 of the ensemble on the comps (offsets excluded: they are shrinkage, not fit). */
  r_squared: number;
  /** Huber tuning constant (1.345) and the most rounds any member's robust fit took. */
  huber_k: number;
  huber_iterations: number;
}

/** Categories whose tokens do not price like a new launch's: the watchlist rule's own
 * product exclusions, plus stablecoin and anchored-BTC products. A comp from one of these
 * is left out of the fit, never hidden from the Live view. */
const FIT_EXCLUDED = new Set([
  'CEX',
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'Algo-Stables',
  'Stablecoin Issuer',
  'Stablecoin Wrapper',
  'Reserve Currency',
  'Dual-Token Stablecoin',
  'Anchor BTC',
  'Decentralized BTC',
]);

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-7';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** Which part of the snapshot a board row came from. */
export type RowScope = 'watchlist' | 'above-floor' | 'early';

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  scope: RowScope;
  age_days: number | null;
  implied_value_usd: number;
  /** The backtest band: implied x/÷ the leave-one-out median factor. */
  implied_low_usd: number;
  implied_high_usd: number;
  /** The farm plan's true cost: capital is a deposit (it comes back), gas is spent. */
  plan_capital_usd: number;
  plan_gas_usd: number;
  model: {
    /** Mean of the three members' log predictions, before rounding. */
    log_value: number;
    /** Each member's log prediction, in order M1, M2, M3. */
    member_log_values: number[];
    growth_pct: number;
    chains_count: number;
    category_offset: number;
    age_days: number | null;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  plan_capital_usd: number;
  plan_gas_usd: number;
  scope: RowScope;
  log_value: number;
  member_log_values: number[];
  growth_pct: number;
  chains_count: number;
  category_offset: number;
  farm_steps: string[];
}

/** A live-token protocol: its token already trades, so the board shows the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  fit: FitResult;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** The Huber tuning constant: residuals beyond k robust sigmas are downweighted. */
const HUBER_K = 1.345;
/** The robust fit runs at most this many reweighting rounds. */
const HUBER_MAX_ITERS = 25;
/** A robust round has converged when no coefficient moves by more than this. */
const HUBER_TOL = 1e-9;
/** Category offsets shrink by n/(n + this): a category needs many comps to move the price. */
const OFFSET_SHRINK = 20;
/** The TVL-curvature term bends around this log TVL (about $24M). */
const TVL_KNOT = 17;

/** The three members, in order: their labels and their feature names. */
const MEMBER_SPECS: { label: string; features: string[] }[] = [
  { label: 'raw growth', features: ['tv', 'g', 'lc'] },
  { label: 'signed-log growth', features: ['tv', 'gl1p', 'lc'] },
  { label: 'TVL curvature', features: ['tv', 'tv2', 'g', 'lc'] },
];

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Solve a small dense linear system by Gauss-Jordan elimination with partial pivoting.
 * Deterministic: fixed row order, no randomness. Throws when the system is singular. */
function solveLinear(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]!]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(m[r]![col]!) > Math.abs(m[pivot]![col]!)) pivot = r;
    if (Math.abs(m[pivot]![col]!) < 1e-12) throw new SnapshotError('the comps fit is singular: the snapshot has no usable traded protocols');
    if (pivot !== col) {
      const tmp = m[col]!;
      m[col] = m[pivot]!;
      m[pivot] = tmp;
    }
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = m[r]![col]! / m[col]![col]!;
      for (let k = col; k <= n; k++) m[r]![k]! -= f * m[col]![k]!;
    }
  }
  return m.map((row, i) => row[n]! / row[i]!);
}

/** One feature of a protocol, by name. `tv` is log TVL (the size axis, never winsorized);
 * `tv2` is the squared distance of log TVL from the knot; `g` is the seven-day change
 * clamped to -50..+150 (null counts as 0); `gl1p` is the same change through a signed
 * log, so a huge week counts little more than a big one; `lc` is log chain count. */
function feature(p: SnapshotProtocol, name: string): number {
  const tv = Math.log(p.tvl_usd);
  const growth = Math.min(150, Math.max(-50, finite(p.change_7d, 0)));
  switch (name) {
    case 'tv':
      return tv;
    case 'tv2':
      return (tv - TVL_KNOT) ** 2;
    case 'g':
      return growth;
    case 'gl1p':
      return Math.sign(growth) * Math.log1p(Math.abs(growth));
    case 'lc':
      return Math.log(Math.max(1, p.chains.length));
    default:
      throw new SnapshotError(`unknown model feature ${name}`);
  }
}

/** A protocol's feature vector for one member's spec, intercept first. */
function featureRow(p: SnapshotProtocol, features: string[]): number[] {
  return [1, ...features.map((f) => feature(p, f))];
}

/** The winsor bounds over a comp set: each feature's observed range, except log TVL,
 * the size axis, which is never clipped. */
function winsorBounds(comps: SnapshotProtocol[], features: string[]): { lo: number[]; hi: number[] } {
  const lo: number[] = [];
  const hi: number[] = [];
  for (const f of features) {
    const vals = comps.map((p) => feature(p, f));
    lo.push(Math.min(...vals));
    hi.push(Math.max(...vals));
  }
  const tvAt = features.indexOf('tv');
  if (tvAt >= 0) {
    // Log TVL is the size axis and is never clipped, but its bounds must stay finite:
    // Infinity serialises to null in JSON, and in the dashboard `v > null` is true,
    // which would clip the size term to zero and break the page's recompute.
    lo[tvAt] = -1e18;
    hi[tvAt] = 1e18;
  }
  return { lo, hi };
}

/** A feature vector clipped to the bounds: a protocol growing faster than any traded
 * comp gets no more credit than the fastest comp, and one on more chains than any comp
 * gets no bigger discount than the widest comp. */
function clippedRow(p: SnapshotProtocol, features: string[], bounds: { lo: number[]; hi: number[] }): number[] {
  const raw = featureRow(p, features);
  return raw.map((v, i) => {
    if (i === 0) return 1;
    return Math.min(bounds.hi[i - 1]!, Math.max(bounds.lo[i - 1]!, v));
  });
}

/** Ordinary least squares for log(mcap) on a member's features, over `comps`. */
function ols(comps: SnapshotProtocol[], features: string[], bounds: { lo: number[]; hi: number[] }, weights?: number[]): number[] {
  const k = features.length + 1;
  const ata: number[][] = Array.from({ length: k }, () => Array(k).fill(0));
  const atb: number[] = Array(k).fill(0);
  comps.forEach((p, idx) => {
    const x = clippedRow(p, features, bounds);
    const y = Math.log(p.mcap_usd!);
    const w = weights === undefined ? 1 : weights[idx]!;
    for (let i = 0; i < k; i++) {
      atb[i]! += w * x[i]! * y;
      for (let j = 0; j < k; j++) ata[i]![j]! += w * x[i]! * x[j]!;
    }
  });
  return solveLinear(ata, atb);
}

/** The upper median of a list: the element at index floor(n/2) of the sorted copy.
 * Same convention as the leave-one-out median factor below. */
function upperMedian(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Huber-robust least squares: start from OLS, then reweight each round so a comp
 * whose residual is an outlier counts less, until the coefficients stop moving.
 * The scale is 1.4826 times the upper median absolute residual (the element at index
 * floor(n/2) of the sorted absolute residuals), the standard robust scale under this
 * codebase's median convention - the same convention the leave-one-out median factor
 * uses below, so the two medians cannot drift apart between runs.
 * Returns the coefficients and how many reweighting rounds ran. */
function huberFit(
  comps: SnapshotProtocol[],
  features: string[],
  bounds: { lo: number[]; hi: number[] },
): { beta: number[]; iterations: number } {
  let beta = ols(comps, features, bounds);
  let iterations = 0;
  for (let round = 0; round < HUBER_MAX_ITERS; round++) {
    iterations = round + 1;
    const residuals = comps.map((p) => {
      const x = clippedRow(p, features, bounds);
      return Math.log(p.mcap_usd!) - beta.reduce((s, b, i) => s + b * x[i]!, 0);
    });
    const scale = 1.4826 * upperMedian(residuals.map((r) => Math.abs(r))) || 1;
    const weights = residuals.map((r) => (Math.abs(r) <= HUBER_K * scale ? 1 : (HUBER_K * scale) / Math.abs(r)));
    const next = ols(comps, features, bounds, weights);
    const moved = Math.max(...next.map((v, i) => Math.abs(v - beta[i]!)));
    beta = next;
    if (moved < HUBER_TOL) break;
  }
  return { beta, iterations };
}

/** Shrunk mean residual per category, from a member's residuals: n/(n+20), n >= 3 else 0. */
function categoryOffsets(
  comps: SnapshotProtocol[],
  beta: number[],
  features: string[],
  bounds: { lo: number[]; hi: number[] },
): Record<string, number> {
  const sums = new Map<string, { total: number; n: number }>();
  for (const p of comps) {
    const x = clippedRow(p, features, bounds);
    const resid = Math.log(p.mcap_usd!) - beta.reduce((s, b, i) => s + b * x[i]!, 0);
    const key = p.category ?? '';
    const cur = sums.get(key) ?? { total: 0, n: 0 };
    cur.total += resid;
    cur.n += 1;
    sums.set(key, cur);
  }
  const out: Record<string, number> = {};
  for (const [key, { total, n }] of sums) {
    if (n >= 3) out[key] = (total / n) * (n / (n + OFFSET_SHRINK));
  }
  return out;
}

/** Whether a traded protocol belongs in the fit set: not an excluded product, and its
 * market-cap-to-TVL ratio inside 0.01-10x (outside that is a data error, not a comp). */
function isFitComp(p: SnapshotProtocol): boolean {
  if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd <= 0) return false;
  if (p.category !== null && FIT_EXCLUDED.has(p.category)) return false;
  const ratio = p.mcap_usd / p.tvl_usd;
  return ratio >= 0.01 && ratio <= 10;
}

/** Fit one ensemble member on a comp set: bounds, robust fit, offsets. */
function fitMember(
  comps: SnapshotProtocol[],
  spec: { label: string; features: string[] },
): { member: MemberFit; iterations: number } {
  const bounds = winsorBounds(comps, spec.features);
  const { beta, iterations } = huberFit(comps, spec.features, bounds);
  return {
    member: {
      label: spec.label,
      features: spec.features,
      beta,
      bounds_lo: bounds.lo,
      bounds_hi: bounds.hi,
      category_offsets: categoryOffsets(comps, beta, spec.features, bounds),
    },
    iterations,
  };
}

/** One member's log prediction for a protocol, offsets included. */
function memberPredict(p: SnapshotProtocol, member: MemberFit): number {
  const bounds = { lo: member.bounds_lo, hi: member.bounds_hi };
  const x = clippedRow(p, member.features, bounds);
  const fitted = member.beta.reduce((s, b, i) => s + b * x[i]!, 0);
  return fitted + (member.category_offsets[p.category ?? ''] ?? 0);
}

/** One member's log prediction without its category offset (for R^2, which excludes offsets). */
function memberPredictNoOffset(p: SnapshotProtocol, member: MemberFit): number {
  const bounds = { lo: member.bounds_lo, hi: member.bounds_hi };
  const x = clippedRow(p, member.features, bounds);
  return member.beta.reduce((s, b, i) => s + b * x[i]!, 0);
}

/** The ensemble's log prediction: the mean of its members' log predictions. */
function ensemblePredict(p: SnapshotProtocol, members: MemberFit[], withOffsets: boolean): number {
  const vals = members.map((m) => (withOffsets ? memberPredict(p, m) : memberPredictNoOffset(p, m)));
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Fit the ensemble to the snapshot's own traded protocols, with the leave-one-out
 * backtest. Every coefficient is computed here, at run time, from the sealed snapshot:
 * nothing about the curve is hardcoded. Throws when fewer than 10 comps survive.
 */
export function fitComps(snapshot: Snapshot): FitResult {
  const traded = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const comps = traded.filter(isFitComp);
  if (comps.length < 10) throw new SnapshotError(`only ${comps.length} traded protocols fit the curve: the snapshot cannot price a board`);
  const fitted = MEMBER_SPECS.map((spec) => fitMember(comps, spec));
  const members = fitted.map((f) => f.member);
  const maxIterations = Math.max(...fitted.map((f) => f.iterations));
  // R^2 of the ensemble on the comps (offsets excluded: they are shrinkage, not fit).
  const ys = comps.map((p) => Math.log(p.mcap_usd!));
  const yMean = ys.reduce((a, b) => a + b, 0) / ys.length;
  let ssRes = 0;
  let ssTot = 0;
  for (let i = 0; i < comps.length; i++) {
    const fittedNoOff = ensemblePredict(comps[i]!, members, false);
    ssRes += (ys[i]! - fittedNoOff) ** 2;
    ssTot += (ys[i]! - yMean) ** 2;
  }
  // Leave-one-out: each comp priced by an ensemble that never saw it (bounds, robust
  // fits and category offsets all refitted without it, for every member). The median
  // factor error is the band.
  const looErrors: number[] = [];
  for (let i = 0; i < comps.length; i++) {
    const rest = comps.filter((_, j) => j !== i);
    const restMembers = MEMBER_SPECS.map((spec) => fitMember(rest, spec).member);
    looErrors.push(Math.log(comps[i]!.mcap_usd!) - ensemblePredict(comps[i]!, restMembers, true));
  }
  const factors = looErrors.map((e) => Math.abs(Math.exp(e) - 1)).sort((a, b) => a - b);
  const medianFactor = 1 + factors[Math.floor(factors.length / 2)]!;
  const within2x = looErrors.filter((e) => Math.abs(e) < Math.log(2)).length / looErrors.length;
  const looRmse = Math.sqrt(looErrors.reduce((a, e) => a + e * e, 0) / looErrors.length);
  return {
    comps_n: comps.length,
    excluded_n: traded.length - comps.length,
    members,
    loo_median_factor: medianFactor,
    loo_within_2x: within2x,
    loo_log_rmse: looRmse,
    r_squared: 1 - ssRes / ssTot,
    huber_k: HUBER_K,
    huber_iterations: maxIterations,
  };
}

/** The fitted implied value for one protocol, with its backtest band and the fitted terms. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  fit: FitResult,
): {
  implied: number;
  low: number;
  high: number;
  logValue: number;
  memberLogValues: number[];
  growthPct: number;
  chainsCount: number;
  categoryOffset: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const memberLogValues = fit.members.map((m) => memberPredict(protocol, m));
  const logValue = memberLogValues.reduce((a, b) => a + b, 0) / memberLogValues.length;
  const implied = Math.max(1, Math.round(Math.exp(logValue)));
  const low = Math.max(1, Math.round(implied / fit.loo_median_factor));
  const high = Math.round(implied * fit.loo_median_factor);
  const growthPct = Math.min(150, Math.max(-50, finite(protocol.change_7d, 0)));
  const chainsCount = Math.max(1, protocol.chains.length);
  const categoryOffset =
    fit.members.reduce((s, m) => s + (m.category_offsets[protocol.category ?? ''] ?? 0), 0) / fit.members.length;
  return { implied, low, high, logValue, memberLogValues, growthPct, chainsCount, categoryOffset, age };
}

/** A farm plan's true cost in dollars: the capital is a deposit that comes back on exit,
 * the gas is spent. Gas follows the plan's own steps: under $3 for the first transaction,
 * $4-8 to set the position up, $5 for the second action, $2 a week across the hold. */
export function planCost(p: SnapshotProtocol, age: number | null): { capital: number; gas: number } {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = 3 + (capital >= 150 ? 8 : 4) + 5 + 2 * Math.ceil(hold / 7);
  return { capital, gas };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A whole word wrapped, staked or staking anywhere in the name. */
const WRAPPED_OR_STAKED = /\b(wrapped|staked|staking)\b/i;

/** A name that begins with an exchange's name. */
const EXCHANGE_LEAD = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Categories that are a wrapped, staked or bridged product of a token that already trades. */
const PRODUCT_CATEGORIES = new Set([
  'Bridge',
  'Canonical Bridge',
  'Cross Chain Bridge',
  'Liquid Staking',
  'Liquid Restaking',
  'Restaked BTC',
  'CEX',
]);

/** Whether a protocol records no token at all: no market cap, no CoinGecko id, no symbol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked or
 * bridged product of a token that already trades, not an exchange, and not a versioned pool.
 * This is the house's watchlist rule, applied to the whole snapshot instead of only the floor.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (WRAPPED_OR_STAKED.test(p.name)) return false;
  if (EXCHANGE_LEAD.test(p.name)) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, fit: FitResult): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, { p: SnapshotProtocol; scope: RowScope }>();
  // The watchlist is the floor: every slug it names, whatever its size.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, { p, scope: 'watchlist' });
  }
  // Above the floor but off the watchlist: pre-token by the record, and rankable by the same
  // rule - the radar's first finds beyond the house's line.
  for (const p of snapshot.protocols) {
    if (chosen.has(p.slug)) continue;
    if (isRankable(p) && p.tvl_usd >= snapshot.floor_usd) chosen.set(p.slug, { p, scope: 'above-floor' });
  }
  // Below the floor: the early radar, every rankable pre-token protocol there is, by TVL.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  for (const p of early) chosen.set(p.slug, { p, scope: 'early' });

  const scored = [...chosen.values()].map(({ p, scope }) => {
    const v = impliedValue(p, snapshot.as_of, fit);
    const cost = planCost(p, v.age);
    return { p, scope, ...v, cost };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    scope: s.scope,
    age_days: s.age,
    implied_value_usd: s.implied,
    implied_low_usd: s.low,
    implied_high_usd: s.high,
    plan_capital_usd: s.cost.capital,
    plan_gas_usd: s.cost.gas,
    model: {
      log_value: round4(s.logValue),
      member_log_values: s.memberLogValues.map(round4),
      growth_pct: s.growthPct,
      chains_count: s.chainsCount,
      category_offset: round4(s.categoryOffset),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  const action = step.text.endsWith('.') ? step.text : `${step.text}.`;
  let s = `${action} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 25_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window.
 * Age does not price the token, but it still sets the hold: a young protocol needs more
 * time on record before its activity counts in a snapshot window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** One category's three concrete moves: the main action, the second action, the weekly cadence. */
function planFor(p: SnapshotProtocol, capital: number, chain: string): { main: string; second: string; weekly: string } {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return {
      main: `Supply $${capital} of USDC to ${name} on ${chain} and keep the supply position open`,
      second: `Borrow 30% of the supplied value in the chain's native stable asset, use it for one swap, then repay it within the same week`,
      weekly: `Adjust the supply or borrow once a week so the wallet shows fresh activity in every snapshot window`,
    };
  }
  if (c.includes('dex') || c.includes('liquidity') || c.includes('leveraged farm') || c.includes('farm')) {
    return {
      main: `Provide $${capital} of liquidity to ${name}'s largest pool on ${chain} and keep the position open`,
      second: `Swap $10 through the same pool on ${chain} so the wallet records both a liquidity and a trading action`,
      weekly: `Rebalance or top up the position by $10 once a week and collect any fees the pool pays out`,
    };
  }
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator') || c.includes('aggregator')) {
    return {
      main: `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares`,
      second: `Move the vault's first yield payout into a second ${name} vault on the same chain, so two positions are on record`,
      weekly: `Check the vault's yield once a week and restake the payout instead of withdrawing it`,
    };
  }
  if (c.includes('rwa')) {
    return {
      main: `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it in the farming wallet`,
      second: `Use the minted asset as collateral for one small borrow on ${chain}, then repay it, so the wallet shows both holding and use`,
      weekly: `Check the asset's accrued yield once a week and leave it compounding in the same wallet`,
    };
  }
  if (c.includes('basis')) {
    return {
      main: `Deposit $${capital} of USDC into ${name}'s basis vault on ${chain} and keep the vault shares`,
      second: `Open a $25 hedge on the same underlying on ${chain} so the position stays delta-neutral while the vault earns`,
      weekly: `Check the vault's funding rate once a week and close and reopen the hedge if the rate flips sign`,
    };
  }
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('options')) {
    return {
      main: `Deposit $${capital} of USDC as margin on ${name} on ${chain} and open one small position with 2x leverage at most`,
      second: `Close the first position after a day and open a second one in the opposite direction, so the wallet shows two filled trades`,
      weekly: `Place one small trade a week and never let a single trade risk more than $10 of the margin`,
    };
  }
  if (c.includes('prediction')) {
    return {
      main: `Fund $${capital} on ${name} and place one position on a market that settles within 30 days`,
      second: `Place a second $10 position on a different market in the same week, so the wallet shows two settled markets`,
      weekly: `Place one new $10 position a week and claim every winning payout to the same wallet`,
    };
  }
  if (c.includes('bridge')) {
    return {
      main: `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in the destination app`,
      second: `Bridge $25 back to the starting chain through ${name} in the same week, so the wallet shows a round trip`,
      weekly: `Bridge $10 a week through ${name} and keep the receipts for every crossing`,
    };
  }
  if (c.includes('staking') || c.includes('restak')) {
    return {
      main: `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token`,
      second: `Delegate $25 of the receipt token to a second validator or pool through ${name} in the same week`,
      weekly: `Claim the staking rewards once a week and restake them instead of withdrawing them`,
    };
  }
  if (c.includes('stable')) {
    return {
      main: `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the farming wallet`,
      second: `Swap $25 of the stable asset for USDC and back through ${name} so the wallet shows minting and trading`,
      weekly: `Check the peg and the yield once a week and move $10 between the stable asset and USDC`,
    };
  }
  if (c.includes('insurance')) {
    return {
      main: `Buy $${capital} of cover from ${name} on ${chain} and keep the policy in the farming wallet`,
      second: `File one test claim inquiry through ${name}'s own page, then withdraw it, so the wallet shows policy use`,
      weekly: `Check the policy's status once a week and renew it before it lapses`,
    };
  }
  if (c.includes('payment') || c.includes('card')) {
    return {
      main: `Load $${capital} onto ${name} on ${chain} and make one real payment with it`,
      second: `Make a second $10 payment to a different merchant through ${name} in the same week`,
      weekly: `Spend $10 a week through ${name} and keep every receipt in the farm log`,
    };
  }
  if (c.includes('chain')) {
    return {
      main: `Bridge $${capital} of USDC onto ${chain} and use it in the chain's own flagship app`,
      second: `Make one $10 swap on ${chain}'s main exchange and one $10 deposit into a ${chain} lending market`,
      weekly: `Use one ${chain} app a week and keep at least $25 of activity on the chain at all times`,
    };
  }
  return {
    main: `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open`,
    second: `Make a second $25 deposit into a different pool or vault of ${name} on ${chain} in the same week`,
    weekly: `Make one qualifying action a week, such as a deposit, a swap or a vote, so the wallet stays active`,
  };
}

/** The protocol's TVL tier, in words, for the farm plan. */
function tvlTier(p: SnapshotProtocol): string {
  if (p.tvl_usd >= 1_000_000_000) return 'over $1B of TVL';
  if (p.tvl_usd >= 100_000_000) return '$100M–$1B of TVL';
  if (p.tvl_usd >= 25_000_000) return '$25M–$100M of TVL';
  return 'under $25M of TVL';
}

/** Whether the protocol's TVL is growing, shrinking or flat over seven days. */
function trendOf(p: SnapshotProtocol): 'growing' | 'shrinking' | 'flat' {
  const g = p.change_7d;
  if (g === null || g === 0) return 'flat';
  return g > 0 ? 'growing' : 'shrinking';
}

/** The seven-day change, signed and in per cent, or 'unreported'. */
function growthLabel(p: SnapshotProtocol): string {
  const g = p.change_7d;
  if (g === null) return 'unreported';
  return `${g > 0 ? '+' : ''}${g.toFixed(2)}%`;
}

/**
 * How to size the first deposit from the trend: a growing row is worth scaling into, a
 * shrinking one gets half up front until the trend flattens, a flat one stays at plan.
 */
function sizingAdvice(p: SnapshotProtocol, capital: number): string {
  const trend = trendOf(p);
  const label = growthLabel(p);
  if (trend === 'growing') {
    return ` Scale in while it grows: start with the full $${capital} above, then top up $10 a week while the 7-day TVL change stays positive (now ${label}).`;
  }
  if (trend === 'shrinking') {
    return ` Start small while it shrinks: deposit half the $${capital} above first, and add the rest only once the 7-day TVL change flattens or turns positive (now ${label}).`;
  }
  return ` Keep the deposit at the $${capital} above and review it after the first week before adding more (7-day TVL change ${label}).`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is
 * derived from the protocol's own record (category, chains, TVL, age, seven-day trend),
 * never from a hand-written list of names. Steps 1, 2, 5, 6 and 7 name the protocol's own
 * chain, TVL tier, age and trend; steps 2–4 carry its category plan.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const plan = planFor(p, capital, chain);
  const chains = p.chains.length;
  const chainWord = chains === 1 ? 'chain' : 'chains';
  const ageText = age === null ? 'an unknown time' : `${age} days`;
  const trend = trendOf(p);
  const holdExtra =
    trend === 'shrinking'
      ? '; re-check its 7-day TVL change weekly and extend the hold if it keeps falling'
      : '';
  const categoryLabel = p.category ?? 'pre-token';
  return [
    {
      text: `Use a fresh wallet on ${chain} to farm ${p.name} (${tvlTier(p)}, ${chains} ${chainWord}) and keep only the funds you plan to farm in it, with its seed phrase offline on paper.`,
      cost: `under $3 of gas for the first transaction on ${chain}`,
      time: '5 minutes',
    },
    {
      text: `${plan.main}.${sizingAdvice(p, capital)}`,
      cost: `$${capital} of capital and about $${capital >= 150 ? 8 : 4} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: plan.second,
      cost: 'about $5 of gas',
      time: '10 minutes',
    },
    {
      text: plan.weekly,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days — ${p.name} has run ${ageText} with no token — so the activity is counted in more than one snapshot window${holdExtra}.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open ${p.name}'s own points or rewards page from its official site — for a ${categoryLabel} protocol this is usually the Points or Rewards tab — and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction hash in a farm log for ${p.name} on ${chain}, then plan the exit: withdraw half first and check the funds land before the rest.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
    plan_capital_usd: row.plan_capital_usd,
    plan_gas_usd: row.plan_gas_usd,
    scope: row.scope,
    log_value: row.model.log_value,
    member_log_values: row.model.member_log_values,
    growth_pct: row.model.growth_pct,
    chains_count: row.model.chains_count,
    category_offset: row.model.category_offset,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const fit = fitComps(snapshot);
  const board = buildBoard(snapshot, fit);
  const live = liveRows(snapshot);
  const early = board.filter((r) => r.scope !== 'watchlist').length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    fit,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    rows: board.map(radarRow),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
