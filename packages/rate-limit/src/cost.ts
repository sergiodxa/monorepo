/**
 * Normalization for the `cost` argument every adapter accepts. It lives on its
 * own so all four backends agree on what a fractional, zero, or missing cost
 * means, instead of each one guessing at the boundary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The number of budget units an attempt spends: a whole number, at least 1.
 *
 * A cost below 1 would make an attempt free and let a caller bypass the limit
 * entirely, and a fractional cost cannot be represented by counter backends, so
 * both are raised to 1 rather than rejected — a limiter must never be the reason
 * a request fails to be counted.
 *
 * @param cost - The requested cost, possibly `undefined`.
 * @returns A whole cost of at least 1.
 *
 * @example
 * normalizeCost(undefined); // 1
 * @example
 * normalizeCost(2.7); // 2
 */
export function normalizeCost(cost: number | undefined): number {
	if (cost === undefined || !Number.isFinite(cost)) return 1;
	return Math.max(1, Math.trunc(cost));
}
