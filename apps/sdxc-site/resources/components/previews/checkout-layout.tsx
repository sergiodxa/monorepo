/**
 * Live preview for `CheckoutLayout`: a checkout's steps and shipping form beside a sticky order
 * summary on a tinted band. Narrow the frame below 56rem and the folded summary leads instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Button, Input, StepIndicator } from "@sdxc/ui";
import { CartLine } from "@sdxc/ui/commerce/cart-line";
import { CheckoutLayout } from "@sdxc/ui/commerce/checkout-layout";
import { OrderSummary } from "@sdxc/ui/commerce/order-summary";
import { PriceBreakdown } from "@sdxc/ui/travel/price-breakdown";

/** The source the page shows. */
const CODE = `<CheckoutLayout
	steps={
		<StepIndicator label="Checkout steps">
			<StepIndicator.Step number={1} state="complete" href="/checkout/contact">Contact</StepIndicator.Step>
			<StepIndicator.Step number={2} state="current">Shipping</StepIndicator.Step>
			<StepIndicator.Step number={3} state="upcoming">Payment</StepIndicator.Step>
		</StepIndicator>
	}
	summary={<OrderSummary collapsible lines={lines} breakdown={breakdown} total="€84.15" labels={labels} />}
	aside={<p>Free returns within 30 days.</p>}
>
	<form method="post" action="/checkout/shipping">…</form>
</CheckoutLayout>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", paddingBlock: "1rem" })]}>
			<CheckoutLayout
				steps={
					<StepIndicator label="Checkout steps">
						<StepIndicator.Step number={1} state="complete" href="#contact">
							Contact
						</StepIndicator.Step>
						<StepIndicator.Step number={2} state="current">
							Shipping
						</StepIndicator.Step>
						<StepIndicator.Step number={3} state="upcoming">
							Payment
						</StepIndicator.Step>
					</StepIndicator>
				}
				summary={
					<OrderSummary
						collapsible
						lines={
							<ul>
								<CartLine name="Tidepool" details="50×70 · Oak frame" price="€64.00" />
								<CartLine name="Fern study" details="Instant download" price="€20.00" />
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
				}
				aside={
					<p
						mix={[raw({ margin: "0", fontSize: "0.8125rem", color: "var(--ui-neutral-fg-muted)" })]}
					>
						Free returns within 30 days.
					</p>
				}
			>
				<form action="#shipping" mix={[raw({ display: "grid", gap: "1rem" })]}>
					<label mix={[raw({ display: "grid", gap: "0.375rem", fontSize: "0.875rem" })]}>
						Full name
						<Input name="name" autocomplete="name" />
					</label>
					<label mix={[raw({ display: "grid", gap: "0.375rem", fontSize: "0.875rem" })]}>
						Address
						<Input name="address" autocomplete="street-address" />
					</label>
					<Button type="submit">Continue to payment</Button>
				</form>
			</CheckoutLayout>
		</div>
	),
};
