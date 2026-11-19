/**
 * Live preview for `ShippingEstimate`: a postcode already answered with three ways the order
 * could travel, each with its arrival date and price.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { ShippingEstimate } from "@sdxc/ui/commerce/shipping-estimate";

/** The source the page shows. */
const CODE = `<ShippingEstimate
	action="/cart"
	value={url.searchParams.get("postcode") ?? undefined}
	options={rates.map((rate) => ({
		id: rate.id,
		label: rate.name,
		arrives: \`Arrives \${formatDay(rate.arrives)}\`,
		price: rate.price === 0 ? "Free" : formatAmount(rate.price, "GBP"),
	}))}
	labels={{ field: "Postcode", submit: "Estimate", heading: "Estimate shipping" }}
/>`;

/** The ways the preview's order could travel. */
const OPTIONS = [
	{ id: "standard", label: "Standard", arrives: "Arrives Tue 24 Nov", price: "£4.95" },
	{ id: "tracked", label: "Tracked 48", arrives: "Arrives Fri 20 Nov", price: "£6.50" },
	{ id: "express", label: "Express courier", arrives: "Arrives tomorrow", price: "£12.00" },
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "24rem" })]}>
			<ShippingEstimate
				action="#estimate"
				value="LS1 4AP"
				options={OPTIONS}
				labels={{ field: "Postcode", submit: "Estimate", heading: "Estimate shipping" }}
			/>
		</div>
	),
};
