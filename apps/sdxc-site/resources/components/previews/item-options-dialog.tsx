/**
 * Live preview for `ItemOptionsDialog`: a dish's card that opens its options dialog, with a
 * required pick, extras and a quantity, and the add button following the price.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { ItemOptionsDialog } from "@sdxc/ui/commerce/item-options-dialog";
import { MenuItemCard } from "@sdxc/ui/commerce/menu-item-card";
import { OptionGroup } from "@sdxc/ui/commerce/option-group";

/** The source the page shows. */
const CODE = `<MenuItemCard dialog="item-al-pastor" name="Al pastor trio" price="$11.50" />
<ItemOptionsDialog
	id="item-al-pastor"
	action="/cart/add"
	title="Al pastor trio"
	description="Spit-roasted pork, charred pineapple, cilantro and onion."
	base={1150}
	currency="USD"
	total="$11.50"
	fields={{ item: "al-pastor" }}
	quantity={{ label: "Quantity" }}
	submitLabel={<>Add <span data-options-qty>1</span> to cart</>}
	closeLabel="Close"
>
	<OptionGroup name="tortilla" title="Tortilla" required requiredLabel="Required" choices={tortillas} />
	<OptionGroup name="extras" title="Extras" max={3} choices={extras} />
</ItemOptionsDialog>`;

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

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "22rem" })]}>
			<MenuItemCard
				dialog="preview-item-options"
				name="Al pastor trio"
				description="Spit-roasted pork, charred pineapple, cilantro and onion."
				price="$11.50"
				media={<Plate />}
				mediaBackground="oklch(0.9 0.07 75)"
			/>
			<ItemOptionsDialog
				id="preview-item-options"
				action="#add"
				title="Al pastor trio"
				description="Spit-roasted pork, charred pineapple, cilantro and onion."
				price="$11.50"
				media={<Plate />}
				mediaBackground="oklch(0.9 0.07 75)"
				base={1150}
				currency="USD"
				total="$11.50"
				quantity={{ label: "Quantity" }}
				submitLabel={
					<>
						Add <span data-options-qty="">1</span> to cart
					</>
				}
				closeLabel="Close"
			>
				<OptionGroup
					name="tortilla"
					title="Tortilla"
					hint="Pick one"
					required
					requiredLabel="Required"
					choices={[
						{ value: "corn", label: "Blue corn", price: 0 },
						{ value: "flour", label: "Flour", price: 50, priceLabel: "+$0.50" },
					]}
				/>
				<OptionGroup
					name="extras"
					title="Extras"
					hint="Optional, up to 2"
					max={2}
					choices={[
						{ value: "guac", label: "Guacamole", price: 150, priceLabel: "+$1.50" },
						{ value: "queso", label: "Queso fresco", price: 100, priceLabel: "+$1.00" },
						{ value: "onions", label: "Pickled onions", price: 50, priceLabel: "+$0.50" },
					]}
				/>
			</ItemOptionsDialog>
		</div>
	),
};
