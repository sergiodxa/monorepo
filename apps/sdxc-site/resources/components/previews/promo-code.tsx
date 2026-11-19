/**
 * Live preview for `PromoCode`: a cart's promo box with one code applied and a second refused,
 * so the disclosure is open on the field with its error under it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { PromoCode } from "@sdxc/ui/commerce/promo-code";

/** The source the page shows. */
const CODE = `<PromoCode
	action="/cart/promo"
	value={submission?.code}
	error={submission?.error}
	applied={cart.codes.map((code) => ({
		code: code.code,
		label: code.description,
		remove: { action: "/cart/promo/remove", fields: { code: code.code } },
	}))}
	labels={{ toggle: "Have a promo code?", field: "Promo code", apply: "Apply", remove: "Remove" }}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "24rem" })]}>
			<PromoCode
				action="#promo"
				value="SUMMER24"
				error="SUMMER24 ended on 31 August."
				applied={[
					{
						code: "WALLS10",
						label: "10% off prints",
						remove: { action: "#remove", fields: { code: "WALLS10" } },
					},
				]}
				labels={{
					toggle: "Have a promo code?",
					field: "Promo code",
					apply: "Apply",
					remove: "Remove",
				}}
			/>
		</div>
	),
};
