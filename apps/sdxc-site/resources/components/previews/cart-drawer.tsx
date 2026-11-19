/**
 * Live preview for `CartDrawer`: the header's bag link with its count, opening a drawer of two
 * prints with a free-shipping note, the subtotal and checkout. Without script the link goes to
 * the cart page; hydrated, it opens the drawer in place.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { CartDrawer } from "@sdxc/ui/commerce/cart-drawer";
import { CartLine } from "@sdxc/ui/commerce/cart-line";
import { QuantityStepper } from "@sdxc/ui/commerce/quantity-stepper";

/** The source the page shows. */
const CODE = `<CartDrawer.Trigger drawer="bag" href="/cart" count={cart.count} label="Bag" />

<CartDrawer
	id="bag"
	title="Your bag"
	empty="Your bag is empty."
	note={<p>You're €16.00 away from free shipping.</p>}
	subtotal={<><span>Subtotal</span><span>€84.00</span></>}
	checkoutHref="/checkout"
	cartHref="/cart"
	labels={{ checkout: "Checkout", viewCart: "View bag", close: "Close bag" }}
>
	<ul>{cart.lines.map((line) => <CartLine … action={<QuantityStepper … />} />)}</ul>
</CartDrawer>`;

/** The bag's lines. */
const LINES = [
	{ name: "Tidepool", details: "50×70 · Oak frame", price: "€64.00", qty: 1 },
	{ name: "Fern study", details: "Instant download", price: "€20.00", qty: 1 },
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ display: "flex", alignItems: "center", gap: "0.75rem" })]}>
			<span mix={[raw({ fontSize: "0.875rem", color: "var(--ui-neutral-fg-muted)" })]}>
				Open the bag
			</span>
			<CartDrawer.Trigger drawer="preview-bag" href="#cart" count={2} label="Bag" />
			<CartDrawer
				id="preview-bag"
				title="Your bag"
				empty="Your bag is empty."
				note={
					<div mix={[raw({ display: "grid", gap: "0.375rem", fontSize: "0.8125rem" })]}>
						<span>You're €16.00 away from free shipping.</span>
						<meter
							value={84}
							max={100}
							aria-label="Progress to free shipping"
							mix={[raw({ inlineSize: "100%" })]}
						/>
					</div>
				}
				subtotal={
					<>
						<span>Subtotal</span>
						<span>€84.00</span>
					</>
				}
				checkoutHref="#checkout"
				cartHref="#cart"
				labels={{ checkout: "Checkout", viewCart: "View bag", close: "Close bag" }}
			>
				<ul>
					{LINES.map((line) => (
						<CartLine
							name={line.name}
							details={line.details}
							price={line.price}
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
			</CartDrawer>
		</div>
	),
};
