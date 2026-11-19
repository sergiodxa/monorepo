/**
 * Live preview for the order tracker: an order on its way, with its headline and estimate over
 * the status timeline, its current step ringed and the steps before it done.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { OrderSteps } from "@sdxc/ui/commerce/order-tracker";

/** The source the page shows. */
const CODE = `<div id="order">
	<h1 data-order-headline>Your food is being made</h1>
	<span data-order-eta-label>Arriving in</span> <span data-order-eta>18 min</span>
	<OrderSteps steps={steps} current="preparing" />
	<OrderLive
		src={\`/orders/\${order.id}/progress\`}
		root="order"
		steps={steps.map((step) => step.id)}
		headlines={headlines}
		labels={{ arriving: "Arriving in", arrived: "Delivered", done: "Arrived", minutes: "{n} min" }}
	/>
</div>`;

/** A delivery's steps. */
const STEPS = [
	{ id: "placed", label: "Order placed" },
	{ id: "accepted", label: "Restaurant accepted" },
	{ id: "preparing", label: "Being prepared" },
	{ id: "picked-up", label: "Courier picked it up" },
	{ id: "on-the-way", label: "On the way" },
	{ id: "delivered", label: "Delivered" },
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					display: "grid",
					gap: "1rem",
					inlineSize: "100%",
					maxInlineSize: "20rem",
					paddingBlock: "1rem",
				}),
			]}
		>
			<div
				mix={[
					raw({ display: "flex", justifyContent: "space-between", alignItems: "end", gap: "1rem" }),
				]}
			>
				<strong mix={[raw({ fontSize: "1.125rem" })]}>Your food is being made</strong>
				<span mix={[raw({ display: "grid", justifyItems: "end", fontSize: "0.75rem" })]}>
					Arriving in
					<strong mix={[raw({ fontSize: "1.125rem" })]}>18 min</strong>
				</span>
			</div>
			<OrderSteps steps={STEPS} current="preparing" />
		</div>
	),
};
