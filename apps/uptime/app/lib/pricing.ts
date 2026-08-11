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

/**
 * Days the public trial watches a URL for before it reports and stops.
 *
 * Here rather than beside the scheduling that enforces it, because it is a commercial term
 * before it is a cadence: it is quoted on the marketing pages, in the trial page's own copy,
 * and in every email the trial sends, and `resources/content/marketing.ts` cannot reach into
 * `app/data` to read it — nothing under `resources/` imports a data model, and this one
 * integer is not the reason to start. `~/app/data/trial-watch` imports it from here and keeps
 * owning what it *means* for a watch to expire.
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
 * Days a billing month is estimated as when projecting a monitor's check frequency
 * into a monthly ping count. Deliberately 28 rather than 30/31 — it's the shortest
 * month, so every estimate a visitor sees is a floor they won't be surprised above.
 */
export const DAYS_PER_BILLING_MONTH = 28;

/** Minutes in the {@link DAYS_PER_BILLING_MONTH} billing month. */
const MINUTES_PER_BILLING_MONTH = DAYS_PER_BILLING_MONTH * 24 * 60;

/**
 * Intervals a flow monitor may run on: 15 minutes to a day (ADR-027 §7a).
 *
 * A fixed list, unlike every other monitor type's free `interval_seconds`, because a flow
 * run costs orders of magnitude more than a single ping — each step down this list roughly
 * doubles the bill, and a free integer would invite somebody to type `600` and find out on
 * an invoice. Seven values make the whole price range finite, quotable on the pricing page,
 * and renderable as a select whose every option can show its own monthly cost.
 *
 * The floor is 15 minutes and not one minute: a flow's detection latency is bounded below
 * by the run itself, and a flow that must be verified faster wants an HTTP monitor on the
 * endpoint it depends on, which this app already sells at 1-minute resolution for a
 * hundredth of the price. The ceiling is a day because the useful range genuinely ends —
 * a flow checked less often than daily is a reminder, not monitoring.
 */
export const FLOW_INTERVALS_SECONDS = [900, 1_800, 3_600, 10_800, 21_600, 43_200, 86_400] as const;

/** A flow monitor's interval, in seconds. */
export type FlowIntervalSeconds = (typeof FLOW_INTERVALS_SECONDS)[number];

/**
 * The interval a flow monitor gets when its creator doesn't choose one: an hour.
 *
 * Not the floor, deliberately. Nothing about a flow run is included in the subscription, so
 * the default must not also be the most expensive value on the list; an hour is what
 * somebody would pick for a check that costs money per run, and tightening it is one click.
 */
export const DEFAULT_FLOW_INTERVAL_SECONDS: FlowIntervalSeconds = 3_600;

/**
 * How long one flow run may take, and how many requests it may make.
 *
 * Both are commercial terms before they are timeouts, which is why they live here beside the
 * price rather than beside the runner that enforces them: they are what bound the cost of a
 * run, so a run can be billed for what it did rather than for what it might have done.
 * Twenty requests is far more than a flow needs — sign in, read something back, call the
 * endpoint it authorises is three — and the ceiling exists for the spec that loops through a
 * catalogue by hand.
 */
export const FLOW_RUN_TIMEOUT_MS = 30_000;

/** See {@link FLOW_RUN_TIMEOUT_MS}. */
export const FLOW_RUN_MAX_REQUESTS = 20;

/**
 * Is this a selectable flow interval?
 *
 * A type guard rather than a clamp: somebody who asked for 60 seconds should be told no, not
 * silently given 900 and left to discover the difference in a latency chart.
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
 * Groups a run of digits with `,` every three, en-US style (`"100000"` → `"100,000"`).
 *
 * Hand-rolled rather than `Intl.NumberFormat`/`toLocaleString` on purpose: the two
 * formatters below are called while the marketing content module is *evaluating*, and
 * the first `Intl` call in a Worker pays a one-time ICU initialisation that lands
 * entirely in measured startup time — ~7ms of it, for these few strings. Both
 * formatters have to stay `Intl`-free for that to hold, since whichever ran first
 * would pay the initialisation and leave the other looking free. Anything reached from
 * a request handler may use `Intl` freely; only module-scope calls cost startup.
 *
 * A leading `-` rides along in the leftmost group, so signed input stays intact.
 */
function groupDigits(digits: string): string {
	// Walk from the right, so the short group ends up leftmost ("1,234", not "123,4").
	let grouped = "";

	for (let end = digits.length; end > 0; end -= 3) {
		let chunk = digits.slice(Math.max(0, end - 3), end);
		grouped = grouped ? `${chunk},${grouped}` : chunk;
	}

	return grouped;
}

/**
 * Formats a USD amount for the English-only marketing content in
 * `resources/content/marketing.ts`, dropping the cents on whole amounts (`"$5"`,
 * not `"$5.00"`). Anything rendered through a view formats with the visitor's own
 * locale via `Intl.NumberFormat` instead — this exists only so the content file
 * can quote these numbers without hardcoding them.
 *
 * @example formatUsd(5) // "$5"
 * @example formatUsd(5.3) // "$5.30"
 */
export function formatUsd(amount: number): string {
	// The sign is lifted out so it lands before the symbol ("-$5"), where en-US puts it.
	let sign = amount < 0 ? "-" : "";
	// Whole amounts drop the cents entirely; anything else takes both digits, so a
	// fractional amount reads as money ("$5.30") rather than a bare decimal ("$5.3").
	let absolute = Math.abs(amount);
	let digits = Number.isInteger(absolute) ? String(absolute) : absolute.toFixed(2);
	let point = digits.indexOf(".");

	if (point === -1) return `${sign}$${groupDigits(digits)}`;

	return `${sign}$${groupDigits(digits.slice(0, point))}${digits.slice(point)}`;
}

/**
 * Formats a ping count for that same English-only marketing content (`"100,000"`).
 * Counts are whole pings, so a fractional projection rounds rather than showing a
 * decimal — the same thing `maximumFractionDigits: 0` did.
 */
export function formatPings(count: number): string {
	return groupDigits(String(Math.round(count)));
}
