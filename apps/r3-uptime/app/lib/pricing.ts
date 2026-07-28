/**
 * The pricing model, in one place: what the subscription costs, how much usage it
 * covers, and what usage past that costs. Every surface that states or computes a
 * price reads from here — the homepage's pricing calculator, the "how pricing works"
 * copy, the billing FAQ answers, and the cost-comparison tables on the `/vs/:slug`
 * pages — so a price change is this file plus the translated copy that interpolates
 * these numbers, never a hunt through views and content records.
 *
 * Lives in `app/lib` rather than `resources/content` because what we charge is a
 * domain fact, not presentation: the marketing copy quotes it, it doesn't own it.
 * The module is deliberately dependency-free so the pricing-calculator island can
 * import it without pulling anything server-side into the client bundle.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Monthly subscription price, in USD. */
export const BASE_PRICE_USD = 5;

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
 * Days a billing month is estimated as when projecting a monitor's check frequency
 * into a monthly ping count. Deliberately 28 rather than 30/31 — it's the shortest
 * month, so every estimate a visitor sees is a floor they won't be surprised above.
 */
export const DAYS_PER_BILLING_MONTH = 28;

/** Minutes in the {@link DAYS_PER_BILLING_MONTH} billing month. */
const MINUTES_PER_BILLING_MONTH = DAYS_PER_BILLING_MONTH * 24 * 60;

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
 * Prices a monthly ping count against the model above.
 *
 * Usage past the allowance is billed in **whole blocks, rounded up** — there is no
 * per-ping rate. One ping over the allowance buys a full block, and one ping past
 * that block buys another: 100,001 pings costs $6, and 110,001 costs $7 ($5 base,
 * one block for the first 10,000 over, a second block for the single ping past it).
 * Anything that divides the block price by {@link PINGS_PER_BLOCK} to get a unit rate
 * will understate every bill.
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
 * Formats a USD amount for the English-only marketing content in
 * `resources/content/marketing.ts`, dropping the cents on whole amounts (`"$5"`,
 * not `"$5.00"`). Anything rendered through a view formats with the visitor's own
 * locale via `Intl.NumberFormat` instead — this exists only so the content file
 * can quote these numbers without hardcoding them.
 */
export function formatUsd(amount: number): string {
	// Whole amounts drop the cents entirely; anything else takes both digits, so a
	// fractional amount reads as money ("$5.30") rather than a bare decimal ("$5.3").
	let fractionDigits = Number.isInteger(amount) ? 0 : 2;

	return amount.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	});
}

/** Formats a ping count for that same English-only marketing content (`"100,000"`). */
export function formatPings(count: number): string {
	return count.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
