/**
 * Normalization for the `cost` argument every adapter accepts. It lives on its
 * own so all four backends agree on what a fractional, zero, or missing cost
 * means, keeping the boundary consistent everywhere a cost is spent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * The number of budget units an attempt spends: a whole number, at least 1.
 * A free (sub-1) or fractional cost would let counting slip past the limit or
 * break on counter backends, so both are raised to 1, keeping every attempt counted.
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
