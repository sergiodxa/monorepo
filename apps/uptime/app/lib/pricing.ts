/**
 * The pricing model, in one place: what the subscription costs, how much usage it
 * covers, and what usage past that costs. Every surface that states or computes a
 * price — the pricing calculator, FAQ, and the `/vs/:slug` comparison tables —
 * reads from here, so a price change touches only this file and the copy that
 * interpolates it.
 *
 * Placed in `app/lib` as a domain fact the marketing copy quotes; the module
 * stays dependency-free so the pricing-calculator island can import it directly
 * into the client bundle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Monthly subscription price, in USD. */
export const BASE_PRICE_USD = 5;

/**
 * Days the public trial watches a URL before it reports and stops. A commercial
 * term quoted across the marketing pages, trial page, and trial emails, so it
 * lives here where `resources/content/marketing.ts` can read it directly.
 *
 * @see `~/app/data/trial-watch` — owns what it means for a watch to expire.
 */
export const FREE_TRIAL_DAYS = 7;

/** Pings the {@link BASE_PRICE_USD} subscription covers before metered usage starts. */
export const INCLUDED_PINGS = 100_000;

/**
 * Usage past {@link INCLUDED_PINGS} is billed per block of this many pings, and
 * blocks are indivisible — see {@link monthlyCost} for why that matters.
 */
export const PINGS_PER_BLOCK = 10_000;

/** Price of one {@link PINGS_PER_BLOCK} block, in USD. */
export const PRICE_PER_BLOCK_USD = 1;

/**
 * Days a billing month is estimated as, when projecting a monitor's check
 * frequency into a monthly ping count. Fixed at the shortest calendar month, so
 * every estimate a visitor sees is a floor they won't be surprised above.
 */
export const DAYS_PER_BILLING_MONTH = 28;

/** Minutes in the {@link DAYS_PER_BILLING_MONTH} billing month. */
const MINUTES_PER_BILLING_MONTH = DAYS_PER_BILLING_MONTH * 24 * 60;

/**
 * Intervals a flow monitor may run on: 15 minutes to a day (ADR-027 §7a). A
 * fixed list because each step down roughly doubles the run cost, so a free
 * integer would let someone type `600` and find out on an invoice.
 */
export const FLOW_INTERVALS_SECONDS = [900, 1_800, 3_600, 10_800, 21_600, 43_200, 86_400] as const;

/** A flow monitor's interval, in seconds. */
export type FlowIntervalSeconds = (typeof FLOW_INTERVALS_SECONDS)[number];

/**
 * The interval a flow monitor gets by default: an hour. Priced per run, so the
 * default sits above the floor — cheap enough to pick for a check that costs
 * money each time, with tightening one click away.
 */
export const DEFAULT_FLOW_INTERVAL_SECONDS: FlowIntervalSeconds = 3_600;

/**
 * How long one flow run may take, and how many requests it may make. Both bound
 * the cost of a run, so a run bills for what it actually did — twenty requests
 * covers a sign-in, a read-back, and one authorised call, with room for a loop.
 */
export const FLOW_RUN_TIMEOUT_MS = 30_000;

/** See {@link FLOW_RUN_TIMEOUT_MS}. */
export const FLOW_RUN_MAX_REQUESTS = 20;

/**
 * Is this a selectable flow interval? A caller who asks for 60 seconds gets a
 * false result immediately, surfacing the unsupported value where it's chosen.
 */
export function isFlowIntervalSeconds(seconds: number): seconds is FlowIntervalSeconds {
	return (FLOW_INTERVALS_SECONDS as readonly number[]).includes(seconds);
}

/** A monitoring setup, as the input to a monthly ping projection. */
export interface Usage {
	/** How many monitors run on this schedule. */
	monitors: number;
	/** Minutes between checks for each of them. */
	intervalMinutes: number;
}

/**
 * Monthly pings a setup produces: one check per interval per monitor, over a
 * {@link DAYS_PER_BILLING_MONTH}-day month.
 *
 * @example monthlyPings({ monitors: 10, intervalMinutes: 30 }) // 13440
 */
export function monthlyPings(usage: Usage): number {
	return (usage.monitors * MINUTES_PER_BILLING_MONTH) / usage.intervalMinutes;
}

/** What a given monthly ping count costs, split into the parts the calculator itemizes. */
export interface CostBreakdown {
	/** Pings covered by the base subscription. */
	includedPings: number;
	/** Pings past {@link CostBreakdown.includedPings}, the volume the blocks are billed for. */
	additionalPings: number;
	/** Whole blocks billed for that volume — {@link CostBreakdown.additionalPings} rounded up. */
	billedBlocks: number;
	/** Cost of those blocks, in USD. */
	additionalCostUsd: number;
	/** Base subscription plus billed blocks, in USD. */
	totalUsd: number;
}

/**
 * Prices a monthly ping count. Usage past the allowance bills in whole blocks,
 * rounded up, with no per-ping rate: 100,001 pings costs $6, and 110,001 costs
 * $7. Dividing the block price by {@link PINGS_PER_BLOCK} understates every bill.
 *
 * @example monthlyCost(13_440).totalUsd // 5 — inside the included allowance
 * @example monthlyCost(100_001).totalUsd // 6 — one ping over buys a whole block
 * @example monthlyCost(110_001).totalUsd // 7 — and one ping past that buys another
 */
export function monthlyCost(pings: number): CostBreakdown {
	let additionalPings = Math.max(0, pings - INCLUDED_PINGS);
	let billedBlocks = Math.ceil(additionalPings / PINGS_PER_BLOCK);
	let additionalCostUsd = billedBlocks * PRICE_PER_BLOCK_USD;

	return {
		includedPings: INCLUDED_PINGS,
		additionalPings,
		billedBlocks,
		additionalCostUsd,
		totalUsd: BASE_PRICE_USD + additionalCostUsd,
	};
}

/**
 * Prices a monitoring setup directly — {@link monthlyPings} composed with
 * {@link monthlyCost}, for the call sites that describe a setup rather than a count.
 */
export function monthlyCostForUsage(usage: Usage): CostBreakdown {
	return monthlyCost(monthlyPings(usage));
}

/**
 * Groups digits with `,` every three, en-US style. Hand-rolled to skip the
 * one-time ~7ms Intl/ICU startup cost paid at module-evaluation time, walking
 * from the right so the short group lands leftmost (`"1,234"`, not `"123,4"`).
 */
function groupDigits(digits: string): string {
	let grouped = "";

	for (let end = digits.length; end > 0; end -= 3) {
		let chunk = digits.slice(Math.max(0, end - 3), end);
		grouped = grouped ? `${chunk},${grouped}` : chunk;
	}

	return grouped;
}

/**
 * Formats a USD amount for the English-only marketing content in
 * `resources/content/marketing.ts`, dropping cents on whole amounts (`"$5"`, not
 * `"$5.00"`), so the content file can quote a live price directly.
 *
 * @example formatUsd(5) // "$5"
 * @example formatUsd(5.3) // "$5.30"
 */
export function formatUsd(amount: number): string {
	let sign = amount < 0 ? "-" : "";
	let absolute = Math.abs(amount);
	let digits = Number.isInteger(absolute) ? String(absolute) : absolute.toFixed(2);
	let point = digits.indexOf(".");

	if (point === -1) return `${sign}$${groupDigits(digits)}`;

	return `${sign}$${groupDigits(digits.slice(0, point))}${digits.slice(point)}`;
}

/**
 * Formats a ping count for that same English-only marketing content (`"100,000"`).
 * Counts are whole pings, so a fractional projection rounds to the nearest
 * integer before grouping, matching `maximumFractionDigits: 0`.
 */
export function formatPings(count: number): string {
	return groupDigits(String(Math.round(count)));
}
