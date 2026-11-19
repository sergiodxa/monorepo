/**
 * Live preview for `CartLine`: a short cart of two lines, each with its picture, picks, price
 * and a quantity stepper at the end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { CartLine } from "@sdxc/ui/commerce/cart-line";
import { QuantityStepper } from "@sdxc/ui/commerce/quantity-stepper";

/** The source the page shows. */
const CODE = `<ul>
	{cart.lines.map((line, index) => (
		<CartLine
			name={line.name}
			details={line.picks.join(" · ")}
			price={formatAmount(line.total, "USD")}
			media={<img src={line.picture} alt="" />}
			action={<QuantityStepper action="/cart/line" value={line.qty} fields={{ line: String(index) }} labels={labels(line)} />}
		/>
	))}
</ul>`;

/** A plate drawn in two circles, standing in for the dish's picture. */
function Plate() {
	return () => (
		<svg
			viewBox="0 0 40 40"
			aria-hidden="true"
			mix={[raw({ display: "block", inlineSize: "100%" })]}
		>
			<circle cx="20" cy="20" r="17" fill="oklch(0.95 0.02 90)" />
			<circle cx="20" cy="20" r="11" fill="oklch(0.72 0.15 45)" />
		</svg>
	);
}

/** The cart's lines. */
const LINES = [
	{ name: "Al pastor trio", picks: "Flour · Habanero mango · Guacamole", price: "$14.25", qty: 1 },
	{ name: "Horchata", picks: "", price: "$8.00", qty: 2 },
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<ul
			mix={[
				raw({
					inlineSize: "100%",
					maxInlineSize: "26rem",
					margin: "0",
					padding: "0",
					listStyle: "none",
				}),
			]}
		>
			{LINES.map((line) => (
				<CartLine
					name={line.name}
					details={line.picks === "" ? undefined : line.picks}
					price={line.price}
					media={<Plate />}
					mediaBackground="oklch(0.9 0.07 75)"
					action={
						<QuantityStepper
							action="#line"
							value={line.qty}
							labels={{
								fewer: `One fewer ${line.name}`,
								more: `One more ${line.name}`,
								remove: `Remove ${line.name}`,
								count: `${line.qty} of ${line.name}`,
							}}
						/>
					}
				/>
			))}
		</ul>
	),
};
