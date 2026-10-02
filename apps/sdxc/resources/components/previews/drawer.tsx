/**
 * Live preview island for `Drawer`. The panel is a `Dialog` docked to an edge — the right
 * one here, which is where a cart lives — so showing and dismissing it are the platform's
 * commands and work with no script at all.
 *
 * The cart inside is what the drawer is for, and that part is hydrated: `stepper()` gives
 * each quantity's buttons press-and-hold repeat, and the island recomputes the line totals
 * and the footer from the rows so no number disagrees with another.
 *
 * Each line keeps its quantity inside the content slot rather than the trailing action
 * slot, because a 22rem dock is narrow enough that a row with both a description and a
 * trailing control reads better stacked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ShoppingCartIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { grow, hstack, vstack } from "@sdxc/u/layout";
import { overflowY } from "@sdxc/u/overflow";
import { is, mbs, minBs } from "@sdxc/u/size";
import { tabularNums, text, weight } from "@sdxc/u/typography";
import { Button, Drawer, Item, NumberField, Separator, Text } from "@sdxc/ui";
import {
	NUMBER_FIELD_STEP_DOWN_COMMAND,
	NUMBER_FIELD_STEP_UP_COMMAND,
	stepper,
} from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

import type { CartLine } from "~/app/services/preview-cart";

import { CART_LINES, cartTotals, formatPrice } from "~/app/services/preview-cart";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const DRAWER_CODE = `let lines: CartLine[] = CART_LINES.map((line) => ({ ...line }));

function changeQuantity(event: Event & { currentTarget: HTMLInputElement }) {
	let line = lines.find((candidate) => candidate.id === event.currentTarget.dataset.line);
	if (!line) return;
	line.quantity = Math.max(1, Number(event.currentTarget.value) || 1);
	void handle.update();
}

let totals = cartTotals(lines);

<Button commandfor="cart" command="show-modal">
	<ShoppingCartIcon />
	Cart · {totals.itemCount}
</Button>

<Drawer id="cart" placement="right" aria-labelledby="cart-title">
	<Drawer.Header>
		<Drawer.Title id="cart-title">Your cart</Drawer.Title>
		<Drawer.Description>
			{totals.freeShipping ? "Shipping is on us on this order." : "Spend $150 to get free shipping."}
		</Drawer.Description>
	</Drawer.Header>

	<div
		mix={[
			vstack({ gap: 4, align: "stretch" }),
			// The dock is as tall as the viewport, so everything between the header and the
			// footer scrolls as one column — the checkout button never slides out of reach.
			grow(),
			minBs(0),
			overflowY("auto"),
		]}
	>
		{lines.map((line) => (
			<Item key={line.id}>
				<Item.Content>
					<Item.Title>{line.name}</Item.Title>
					<Item.Description>{line.variant}</Item.Description>
					<div mix={[hstack({ gap: 2, align: "center", justify: "between" }), mbs(1)]}>
						<NumberField.Group mix={[stepper()]}>
							<NumberField.DecrementButton
								command={NUMBER_FIELD_STEP_DOWN_COMMAND}
								commandfor={\`cart-quantity-\${line.id}\`}
								aria-label={\`One fewer \${line.name}\`}
							/>
							<NumberField.Input
								id={\`cart-quantity-\${line.id}\`}
								name={\`quantity[\${line.id}]\`}
								data-line={line.id}
								min={1}
								max={99}
								value={String(line.quantity)}
								aria-label={\`Quantity of \${line.name}\`}
								mix={[on<HTMLInputElement, "input">("input", changeQuantity)]}
							/>
							<NumberField.IncrementButton
								command={NUMBER_FIELD_STEP_UP_COMMAND}
								commandfor={\`cart-quantity-\${line.id}\`}
								aria-label={\`One more \${line.name}\`}
							/>
						</NumberField.Group>
						<span>{formatPrice(line.unitPrice * line.quantity)}</span>
					</div>
				</Item.Content>
			</Item>
		))}

		<Separator />

		<Text>Subtotal</Text>
		<Text>{totals.subtotal}</Text>
		<Text>Shipping</Text>
		<Text>{totals.shipping}</Text>
		<Text>Total</Text>
		<Text>{totals.total}</Text>
	</div>

	<Drawer.Footer>
		<Button commandfor="cart" command="close" variant="outline" color="neutral">
			Keep shopping
		</Button>
		<Button commandfor="cart" command="close">Checkout · {totals.total}</Button>
	</Drawer.Footer>
	<Drawer.Close commandfor="cart" aria-label="Close the cart" />
</Drawer>`;

/** A cart drawer, hydrated so its quantities step and every total follows them. */
export const DrawerPreview = clientEntry(
	"/resources/components/previews/drawer.tsx#DrawerPreview",
	function DrawerPreview(handle: Handle) {
		let lines: CartLine[] = CART_LINES.map((line) => ({ ...line }));

		/** A quantity changed, by the stepper's repeat or by typing, so the totals follow. */
		function changeQuantity(event: Event & { currentTarget: HTMLInputElement }) {
			let line = lines.find((candidate) => candidate.id === event.currentTarget.dataset.line);
			if (!line) return;
			line.quantity = Math.max(1, Number(event.currentTarget.value) || 1);
			void handle.update();
		}

		return () => {
			let totals = cartTotals(lines);

			return (
				<>
					<Button commandfor="preview-drawer" command="show-modal">
						<ShoppingCartIcon />
						Cart · {String(totals.itemCount)}
					</Button>

					<Drawer id="preview-drawer" placement="right" aria-labelledby="preview-drawer-title">
						<Drawer.Header>
							<Drawer.Title id="preview-drawer-title">Your cart</Drawer.Title>
							<Drawer.Description>
								{totals.freeShipping
									? "Shipping is on us on this order."
									: "Spend $150 to get free shipping."}
							</Drawer.Description>
						</Drawer.Header>

						<div
							mix={[
								vstack({ gap: 4, align: "stretch" }),
								// The dock is as tall as the viewport, so everything between the header and
								// the footer scrolls as one column — the checkout button never slides out
								// of reach.
								grow(),
								minBs(0),
								overflowY("auto"),
							]}
						>
							{lines.map((line) => (
								<Item key={line.id}>
									<Item.Content>
										<Item.Title>{line.name}</Item.Title>
										<Item.Description>{line.variant}</Item.Description>
										<div mix={[hstack({ gap: 2, align: "center", justify: "between" }), mbs(1)]}>
											<NumberField.Group mix={[stepper(), is("7.5rem")]}>
												<NumberField.DecrementButton
													command={NUMBER_FIELD_STEP_DOWN_COMMAND}
													commandfor={`preview-cart-quantity-${line.id}`}
													aria-label={`One fewer ${line.name}`}
												/>
												<NumberField.Input
													id={`preview-cart-quantity-${line.id}`}
													name={`quantity[${line.id}]`}
													data-line={line.id}
													min={1}
													max={99}
													value={String(line.quantity)}
													aria-label={`Quantity of ${line.name}`}
													mix={[on<HTMLInputElement, "input">("input", changeQuantity)]}
												/>
												<NumberField.IncrementButton
													command={NUMBER_FIELD_STEP_UP_COMMAND}
													commandfor={`preview-cart-quantity-${line.id}`}
													aria-label={`One more ${line.name}`}
												/>
											</NumberField.Group>
											<span mix={[text("sm"), weight("medium"), tabularNums()]}>
												{formatPrice(line.unitPrice * line.quantity)}
											</span>
										</div>
									</Item.Content>
								</Item>
							))}

							<Separator />

							<div mix={[vstack({ gap: 1, align: "stretch" })]}>
								<div mix={[hstack({ gap: 4, align: "baseline", justify: "between" })]}>
									<Text>Subtotal</Text>
									<Text>{totals.subtotal}</Text>
								</div>
								<div mix={[hstack({ gap: 4, align: "baseline", justify: "between" })]}>
									<Text>Shipping</Text>
									<Text>{totals.shipping}</Text>
								</div>
								<div mix={[hstack({ gap: 4, align: "baseline", justify: "between" })]}>
									<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>Total</span>
									<span
										mix={[text("sm"), weight("semibold"), tabularNums(), fg("neutral.emphasis")]}
									>
										{totals.total}
									</span>
								</div>
							</div>
						</div>

						<Drawer.Footer>
							<Button commandfor="preview-drawer" command="close" variant="outline" color="neutral">
								Keep shopping
							</Button>
							<Button commandfor="preview-drawer" command="close">
								Checkout · {totals.total}
							</Button>
						</Drawer.Footer>
						<Drawer.Close commandfor="preview-drawer" aria-label="Close the cart" />
					</Drawer>
				</>
			);
		};
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: DRAWER_CODE, render: () => <DrawerPreview /> };
