/**
 * A rate card: cents per unit for each resource a cost ledger meters, fixed in the order the
 * resources are written in, with the zeroed quantities and the pricing function built from it,
 * so a ledger states its rates once and accumulates, prices and stores quantities against them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * How much of each resource a unit of work consumed, in each resource's own unit.
 *
 * @template R - The resource names of the rate card the quantities are priced against.
 */
export type RateCardQuantities<R extends string> = Record<R, number>;

/**
 * Cents per unit for every resource, with the helpers that read quantities against them.
 * `resources` is the order a stored measurement can position its quantities by.
 *
 * @template R - The resource names, in the order the card's rates were written in.
 */
export interface RateCard<R extends string> {
	/** Every resource, in the order the rates were written in. */
	readonly resources: readonly R[];
	/** Cents per unit of each resource. */
	readonly rates: Readonly<RateCardQuantities<R>>;
	/**
	 * A fresh set of quantities with every resource at zero, keyed in {@link RateCard.resources}
	 * order, so accumulating consumption is a plain sum.
	 */
	zero(): RateCardQuantities<R>;
	/**
	 * Prices quantities in cents, resource by resource. A missing resource prices at zero, and
	 * a negative quantity prices at zero too, so every line is `max(0, units) × rate`.
	 *
	 * @param quantities - Units consumed; a partial set is fine.
	 * @returns The total in cents, summed across every resource.
	 */
	price(quantities: Partial<RateCardQuantities<R>>): number;
}

/**
 * The resource names of a rate card, for typing the fields a ledger counts.
 *
 * @template C - A rate card from {@link defineRateCard}.
 */
export type RateCardResource<C> = C extends RateCard<infer R> ? R : never;

/**
 * Builds a rate card from cents per unit, keyed by resource. The key order becomes
 * {@link RateCard.resources}, so append a new resource after the existing ones and write
 * resource names as words: integer-like keys such as `"0"` sort ahead of every other key.
 *
 * @template R - The resource names, inferred from the keys of `rates`.
 * @param rates - Cents per unit of each resource, e.g. `centsPerUnit(D1.ROWS_READ)`.
 * @returns A frozen rate card.
 * @example let card = defineRateCard({ d1RowsRead: centsPerUnit(D1.ROWS_READ) });
 * @example card.price({ d1RowsRead: 1_200 }); // 0.00012
 */
export function defineRateCard<R extends string>(rates: RateCardQuantities<R>): RateCard<R> {
	let resources = Object.freeze(Object.keys(rates) as R[]);
	let frozen = Object.freeze({ ...rates });

	return Object.freeze({
		resources,
		rates: frozen,
		zero() {
			let quantities = {} as RateCardQuantities<R>;
			for (let resource of resources) quantities[resource] = 0;
			return quantities;
		},
		price(quantities: Partial<RateCardQuantities<R>>) {
			let cents = 0;
			for (let resource of resources) {
				cents += Math.max(0, quantities[resource] ?? 0) * frozen[resource];
			}
			return cents;
		},
	});
}
