// Token Radar's value model (radar-3): a sealed snapshot in, a ranked board out.
//
// The board ranks protocols that record no token, by what a token would be worth if the
// protocol's record stayed as it is. It never predicts whether or when a token is issued:
// the implied value is this entry's own claim, derived only from the snapshot's own figures.
//
//   base      = tvl_usd x 0.30
//   growth    = clamp(change_7d, -50, +150) per cent
//   growthMult   = 1 + (growth / 100) x 0.60
//   maturity  = 0.70 + min(age_days, 1460) / 1460 x 0.50   (age_days unknown: 365)
//   category  = fee-capture tier from the category string only (table below)
//   chains    = 1 + 0.02 x min(chains.length, 5), capped at 1.10
//   implied   = max(1, round(base x growthMult x maturity x category x chains))
//
// Growth is rewarded more than decline is punished (a protocol shrinking 20% keeps 88% of its
// base, one growing 20% reaches 112%), because a launch is priced on where the protocol is
// heading, not only where it stands. Maturity rewards staying power: a protocol that has run
// four years with no token has proved it can hold value without one, so its launch is worth
// more than a young protocol's at the same size.
//
// Category fee-capture tier: how directly the category generates fees or value a token can
// capture. Matched by substring on the lowercase category string, in this order ('index'
// first, because "Indexes" contains "dex"; allocator before infra, because "Onchain Capital
// Allocator" contains "chain"). No protocol name ever influences it — category string only.
//   1.15 direct fee capture: Dexs, Lending, Uncollateralized Lending, Derivatives,
//        Interest Rate Derivatives, Basis Trading, Yield, Yield Aggregator, CDP, CDP Manager,
//        Options, Options Vault, Synthetics, Leveraged Farming, Farm, Liquidity Manager,
//        Prediction Market, Collateral Markets, Collateral Management, Insurance
//   1.08 allocator / yield-bearing asset: Risk Curators, Onchain Capital Allocator, RWA,
//        Indexes, Launchpad, Token Locker, Staking Pool, Restaking, Liquid Staking,
//        Liquid Restaking, Restaked BTC, Algo-Stables, Dual-Token Stablecoin, Stablecoin
//        Issuer, Stablecoin Wrapper, Reserve Currency, CeDeFi, Governance Incentives
//   1.00 neutral: NFT Marketplace, OTC Marketplace, Privacy, AI Agents, Decentralized AI,
//        Anchor BTC, Decentralized BTC, DOR, CEX, and any null or unknown category
//   0.92 infrastructure, thin fee capture: Chain, Bridge, Canonical Bridge,
//        Cross Chain Bridge, Payments, Crypto Card Issuer
//
// Chain breadth rewards reach: a protocol live on more chains has more places a token can
// be used, so each chain up to five adds 2%, capped at +10%. No protocol name is ever
// special-cased: the same function scores every row, and the dashboard recomputes it from
// the same five inputs.
//
// Scope: the watchlist is the floor, never the ceiling. The board carries every watchlist
// slug, then every other rankable pre-token protocol: the 19 above the floor the watchlist
// leaves out, and the 138 below it, by TVL. Rankable means pre-token and not a wrapped,
// staked or bridged product of a token that already trades, not an exchange, and not a
// versioned pool — the house's own watchlist rule, applied to the whole snapshot.

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

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  base_multiple: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  category_direct: number;
  category_allocator: number;
  category_neutral: number;
  category_infra: number;
  chain_step: number;
  chain_cap: number;
}

export const MODEL: ModelConstants = {
  base_multiple: 0.3,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 150,
  maturity_floor: 0.7,
  maturity_range: 0.5,
  maturity_days: 1460,
  unknown_age_days: 365,
  category_direct: 1.15,
  category_allocator: 1.08,
  category_neutral: 1.0,
  category_infra: 0.92,
  chain_step: 0.02,
  chain_cap: 1.1,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3';

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
  model: {
    base_multiple: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    category_multiplier: number;
    chain_multiplier: number;
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
  scope: RowScope;
  growth_multiplier: number;
  maturity_multiplier: number;
  category_multiplier: number;
  chain_multiplier: number;
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
  model: ModelConstants;
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

/** A category's fee-capture tier, from the category string only — never the protocol name.
 * Order matters: 'index' before 'dex' ("Indexes" contains "dex"), allocator before infra
 * ("Onchain Capital Allocator" contains "chain"). Unknown or null category is neutral. */
export function categoryMultiplier(protocol: SnapshotProtocol, model: ModelConstants): number {
  const c = (protocol.category ?? '').toLowerCase();
  if (c.includes('index')) return model.category_allocator;
  if (
    c.includes('dex') ||
    c.includes('lend') ||
    c.includes('derivative') ||
    c.includes('basis') ||
    c.includes('yield') ||
    c.includes('cdp') ||
    c.includes('option') ||
    c.includes('synthetic') ||
    c.includes('farm') ||
    c.includes('liquidity') ||
    c.includes('prediction') ||
    c.includes('collateral') ||
    c.includes('insurance')
  ) {
    return model.category_direct;
  }
  if (
    c.includes('curator') ||
    c.includes('allocator') ||
    c.includes('rwa') ||
    c.includes('launchpad') ||
    c.includes('locker') ||
    c.includes('staking') ||
    c.includes('restak') ||
    c.includes('stable') ||
    c.includes('reserve') ||
    c.includes('cedefi') ||
    c.includes('governance')
  ) {
    return model.category_allocator;
  }
  if (c.includes('bridge') || c.includes('chain') || c.includes('payment') || c.includes('card')) {
    return model.category_infra;
  }
  return model.category_neutral;
}

/** Chain breadth: 2% per chain up to five, capped at +10%. */
export function chainMultiplier(protocol: SnapshotProtocol, model: ModelConstants): number {
  return Math.min(model.chain_cap, 1 + model.chain_step * Math.min(protocol.chains.length, 5));
}

/** The five multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
): {
  implied: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  categoryMult: number;
  chainMult: number;
  age: number | null;
} {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult =
    model.maturity_floor +
    (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const categoryMult = categoryMultiplier(protocol, model);
  const chainMult = chainMultiplier(protocol, model);
  const base = protocol.tvl_usd * model.base_multiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult * categoryMult * chainMult));
  return { implied, growthPct, growthMult, maturityMult, categoryMult, chainMult, age };
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
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, { p: SnapshotProtocol; scope: RowScope }>();
  // The watchlist is the floor: every slug it names, whatever its size.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, { p, scope: 'watchlist' });
  }
  // Above the floor but off the watchlist: pre-token by the record, and rankable by the same
  // rule — the radar's first finds beyond the house's line.
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
    const { implied, growthPct, growthMult, maturityMult, categoryMult, chainMult, age } = impliedValue(p, snapshot.as_of, model);
    return { p, scope, implied, growthPct, growthMult, maturityMult, categoryMult, chainMult, age };
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
    model: {
      base_multiple: model.base_multiple,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      category_multiplier: round4(s.categoryMult),
      chain_multiplier: round4(s.chainMult),
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

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
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
    scope: row.scope,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    category_multiplier: row.model.category_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => r.scope !== 'watchlist').length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
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
