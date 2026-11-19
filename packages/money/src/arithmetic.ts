/**
 * Arithmetic on integer minor units that never loses a cent: splitting a total into shares
 * that add back to it, taking a percentage, converting at a rate, and totalling amounts in
 * several currencies without adding one currency to another.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { currencyExponent, roundHalfAway } from "./currency.js";

/** An amount of money: integer minor units of one currency. */
export interface Money {
	/** Minor units (cents, pence, whole yen); negative for money out. */
	amount: number;
	/** The ISO 4217 code. */
	currency: string;
}

/**
 * Splits a total into shares that add up to it exactly. A count splits evenly; a list of
 * weights splits in proportion. The leftover minor units go one at a time to the shares
 * with the largest remainders, the earliest first on a tie, so the result is deterministic.
 *
 * @param total The amount in minor units; a negative total splits into negative shares.
 * @param parts How many even shares (at least 1), or one weight per share.
 * @example allocate(1000, 3) // [334, 333, 333]
 * @example allocate(1000, [1, 1, 2]) // [250, 250, 500]
 */
export function allocate(total: number, parts: number | readonly number[]): number[] {
	let weights =
		typeof parts === "number"
			? Array.from({ length: Math.max(1, Math.floor(parts)) }, () => 1)
			: parts.map((weight) => Math.max(0, weight));
	let sum = weights.reduce((acc, weight) => acc + weight, 0);
	if (sum === 0) weights = weights.map(() => 1);
	let whole = weights.reduce((acc, weight) => acc + weight, 0);
	let sign = total < 0 ? -1 : 1;
	let magnitude = Math.abs(total);
	let exact = weights.map((weight) => (magnitude * weight) / whole);
	let shares = exact.map((value) => Math.floor(value));
	let left = magnitude - shares.reduce((acc, share) => acc + share, 0);
	let order = exact
		.map((value, index) => ({ index, remainder: value - Math.floor(value) }))
		.sort((a, b) => b.remainder - a.remainder || a.index - b.index);
	for (let step = 0; step < left; step++) shares[order[step % order.length]!.index]! += 1;
	return shares.map((share) => sign * share + 0);
}

/**
 * A percentage of an amount, rounded half away from zero to the minor unit: a tip, a fee,
 * a tax line.
 *
 * @param amount The amount in minor units.
 * @param percent The percentage, such as `15` or `7.5`.
 * @example percentOf(4280, 15) // 642
 */
export function percentOf(amount: number, percent: number): number {
	return roundHalfAway(Number(((amount * percent) / 100).toPrecision(15)));
}

/**
 * Converts minor units of one currency into another at a rate quoted per major unit,
 * rounding half away from zero to the target's own minor unit.
 *
 * @param amount Minor units of `from`.
 * @param from The ISO code it is in.
 * @param to The ISO code wanted.
 * @param rate How many units of `to` one unit of `from` buys.
 * @example convert(10000, "GBP", "EUR", 1.1712) // 11712
 * @example convert(30000, "EUR", "JPY", 163.8) // 49140
 */
export function convert(amount: number, from: string, to: string, rate: number): number {
	let major = (amount / 10 ** currencyExponent(from)) * rate;
	return roundHalfAway(Number((major * 10 ** currencyExponent(to)).toPrecision(15)));
}

/**
 * Totals amounts per currency, so a list mixing euros and pounds yields one total of each
 * rather than a meaningless sum.
 *
 * @param amounts The amounts to add.
 * @returns Each currency's total, in first-seen order.
 * @example sumByCurrency([{ amount: 500, currency: "EUR" }, { amount: 250, currency: "EUR" }]) // Map { "EUR" => 750 }
 */
export function sumByCurrency(amounts: Iterable<Money>): Map<string, number> {
	let totals = new Map<string, number>();
	for (let { amount, currency } of amounts)
		totals.set(currency, (totals.get(currency) ?? 0) + amount);
	return totals;
}
