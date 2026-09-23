/**
 * The cart a drawer preview shows, and the arithmetic its footer reads. Prices are held in
 * cents so a subtotal is integer addition and never drifts, and formatting happens once on
 * the way out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

const PRICE_FORMAT = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Shipping is free once the subtotal clears this, which is the nudge the footer shows. */
const FREE_SHIPPING_THRESHOLD = 15_000;

/** A shipping charge in cents, applied while the subtotal sits under the threshold. */
const SHIPPING = 1_200;

/** One line of the cart: a product, the variant chosen, and what one of them costs. */
export interface CartLine {
	id: string;
	name: string;
	variant: string;
	unitPrice: number;
	quantity: number;
}

/** The cart the preview opens with, which is what a returning shopper would see. */
export const CART_LINES: ReadonlyArray<CartLine> = [
	{
		id: "desk-mat",
		name: "Felt desk mat",
		variant: "Charcoal · 90 × 40 cm",
		unitPrice: 4_500,
		quantity: 1,
	},
	{
		id: "keycaps",
		name: "Low-profile keycaps",
		variant: "Warm grey · ISO",
		unitPrice: 6_900,
		quantity: 2,
	},
	{
		id: "cable",
		name: "Coiled USB-C cable",
		variant: "Aviator · 1.5 m",
		unitPrice: 3_200,
		quantity: 1,
	},
];

/** What the footer states: the goods, the shipping, and what the card is charged. */
export interface CartTotals {
	subtotal: string;
	shipping: string;
	total: string;
	itemCount: number;
	freeShipping: boolean;
}

/**
 * A price as the cart writes it.
 *
 * @param cents - The amount in cents.
 * @returns The amount formatted as US dollars.
 */
export function formatPrice(cents: number): string {
	return PRICE_FORMAT.format(cents / 100);
}

/**
 * Everything the cart's footer states, from the quantities the rows currently hold.
 *
 * @param lines - The cart's lines, each carrying its own quantity.
 * @returns The formatted subtotal, shipping and total, plus the item count.
 */
export function cartTotals(lines: ReadonlyArray<CartLine>): CartTotals {
	let subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
	let itemCount = lines.reduce((count, line) => count + line.quantity, 0);
	let freeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
	let shipping = freeShipping ? 0 : SHIPPING;

	return {
		subtotal: formatPrice(subtotal),
		shipping: freeShipping ? "Free" : formatPrice(shipping),
		total: formatPrice(subtotal + shipping),
		itemCount,
		freeShipping,
	};
}
