/**
 * Live preview for `QuantityStepper`: a cart line's count, where − and + are each a form post
 * naming the new count, beside one at a count of one whose − has become a bin.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { QuantityStepper } from "@sdxc/ui/commerce/quantity-stepper";

/** The source the page shows. */
const CODE = `<QuantityStepper
	action="/cart/line"
	value={line.qty}
	fields={{ line: String(index), back: "cart" }}
	labels={{ fewer: \`One fewer \${name}\`, more: \`One more \${name}\`, remove: \`Remove \${name}\`, count: \`\${line.qty} of \${name}\` }}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[raw({ display: "flex", gap: "1.5rem", alignItems: "center", paddingBlock: "1.5rem" })]}
		>
			<QuantityStepper
				action="#line"
				value={2}
				labels={{
					fewer: "One fewer taco",
					more: "One more taco",
					remove: "Remove taco",
					count: "2 tacos",
				}}
			/>
			<QuantityStepper
				action="#line"
				value={1}
				labels={{
					fewer: "One fewer soda",
					more: "One more soda",
					remove: "Remove soda",
					count: "1 soda",
				}}
			/>
		</div>
	),
};
