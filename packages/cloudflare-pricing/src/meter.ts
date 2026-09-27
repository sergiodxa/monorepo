/**
 * The shape every service module states its prices in — the USD amount per published
 * quantity, exactly as Cloudflare's docs print it — and the arithmetic that turns one into
 * cents per unit or cents per GB-day, so a consumer never converts dollars or months by hand.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Every quantity a Cloudflare price is published against. A storage price is always per
 * `"GB-month"`, which is what lets {@link centsPerGbDay} accept storage meters only.
 */
export type Unit =
	| "request"
	| "CPU ms"
	| "log event"
	| "GB-s"
	| "row read"
	| "row written"
	| "key read"
	| "key written"
	| "key deleted"
	| "list request"
	| "operation"
	| "data point"
	| "read query"
	| "email"
	| "Class A operation"
	| "Class B operation"
	| "GB retrieved"
	| "GB-month";

/**
 * A list price transcribed from the docs: `{ usd: 0.3, per: 1_000_000 }` reads
 * "$0.30 per million". Both numbers are the published ones, so re-checking a price is
 * a side-by-side read of the docs table.
 */
export interface Price {
	/** The published amount, in US dollars. */
	usd: number;
	/** How many of the meter's units that amount buys. */
	per: number;
}

/**
 * How often an allowance resets: each UTC day, each monthly billing cycle, per single
 * invocation, or `"total"` for a cap on how much is held at once (Free plan storage).
 */
export type AllowancePeriod = "day" | "month" | "invocation" | "total";

/**
 * A quantity of the meter's unit the plan allows per period — an included allowance billed
 * past, or a Free plan limit past which operations fail. Storage caps are in GB held.
 */
export interface Allowance {
	quantity: number;
	period: AllowancePeriod;
}

/**
 * One billed dimension of a Cloudflare service: its unit, its overage price, the usage the
 * price starts after, and the Workers Free plan's limit where the docs publish one.
 *
 * @template U - The unit the price and both allowances are counted in.
 */
export interface Meter<U extends Unit = Unit> {
	unit: U;
	price: Price;
	/** Usage included before {@link Meter.price} applies; `null` when every unit is billed. */
	included: Allowance | null;
	/** The Workers Free plan's limit; `null` when the service is unavailable there or unlimited. */
	freeLimit: Allowance | null;
}

/**
 * Days in the billing month a GB-month is averaged over, as Cloudflare defines it for
 * storage billing; the divisor that amortizes a GB-month price to one GB held for a day.
 */
export const DAYS_PER_BILLING_MONTH = 30;

/**
 * The list price of a single unit, in cents, as though no allowance applied — the rate a
 * cost ledger multiplies a measured quantity by.
 *
 * @param meter - Any service meter, e.g. `D1.ROWS_READ`.
 * @returns Cents per one `meter.unit`.
 * @example centsPerUnit(Workers.REQUESTS); // 0.00003
 */
export function centsPerUnit(meter: Meter): number {
	return (meter.price.usd * 100) / meter.price.per;
}

/**
 * The price of holding one GB for one day, in cents: the GB-month price spread over
 * {@link DAYS_PER_BILLING_MONTH}. Only storage meters type-check here.
 *
 * @param meter - A storage meter, e.g. `KV.STORAGE`.
 * @returns Cents per GB-day.
 * @example centsPerGbDay(D1.STORAGE); // 2.5
 */
export function centsPerGbDay(meter: Meter<"GB-month">): number {
	return centsPerUnit(meter) / DAYS_PER_BILLING_MONTH;
}
