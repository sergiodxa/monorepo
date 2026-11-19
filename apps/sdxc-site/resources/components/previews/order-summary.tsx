/**
 * Live preview for `OrderSummary`: a checkout's two prints and the charges under them. Narrow
 * the frame below 56rem and it folds behind a row showing the total; wider, it stays open.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { CartLine } from "@sdxc/ui/commerce/cart-line";
import { FulfilmentNote } from "@sdxc/ui/commerce/fulfilment-note";
import { OrderSummary } from "@sdxc/ui/commerce/order-summary";
import { PriceBreakdown } from "@sdxc/ui/travel/price-breakdown";

/** The source the page shows. */
const CODE = `<OrderSummary
	collapsible
	lines={<ul>{cart.lines.map((line) => <CartLine name={line.title} details={line.variant} price={line.price} />)}</ul>}
	breakdown={
		<PriceBreakdown>
			<PriceBreakdown.Line label="Subtotal" amount="€84.00" />
			<PriceBreakdown.Line label="Shipping" amount="€4.95" />
			<PriceBreakdown.Line label="WALLS10" amount="€4.80" tone="discount" />
			<PriceBreakdown.Total label="Total" amount="€84.15" />
		</PriceBreakdown>
	}
	total="€84.15"
	labels={{ show: "Show order summary", heading: "Order summary" }}
/>`;

/** A framed print, drawn as a mount and a wash of colour. */
function Print(handle: Handle<{ color: string }>) {
	return () => (
		<svg
			viewBox="0 0 40 50"
			aria-hidden="true"
			mix={[raw({ display: "block", inlineSize: "100%" })]}
		>
			<rect x="2" y="2" width="36" height="46" fill="white" />
			<rect x="7" y="7" width="26" height="36" fill={handle.props.color} />
		</svg>
	);
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "24rem" })]}>
			<OrderSummary
				collapsible
				lines={
					<ul>
						<CartLine
							name="Tidepool"
							details="50×70 · Oak frame"
							price="€64.00"
							media={<Print color="oklch(0.62 0.09 220)" />}
							mediaBackground="oklch(0.93 0.02 80)"
						/>
						<CartLine
							name="Fern study"
							details={<FulfilmentNote kind="download">Instant download</FulfilmentNote>}
							price="€20.00"
							media={<Print color="oklch(0.6 0.11 150)" />}
							mediaBackground="oklch(0.93 0.02 80)"
						/>
					</ul>
				}
				breakdown={
					<PriceBreakdown>
						<PriceBreakdown.Line label="Subtotal" amount="€84.00" />
						<PriceBreakdown.Line label="Shipping" amount="€4.95" />
						<PriceBreakdown.Line label="WALLS10" amount="€4.80" tone="discount" />
						<PriceBreakdown.Total label="Total" amount="€84.15" />
					</PriceBreakdown>
				}
				total="€84.15"
				labels={{ show: "Show order summary", heading: "Order summary" }}
			/>
		</div>
	),
};
