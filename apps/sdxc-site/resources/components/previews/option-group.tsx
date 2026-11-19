/**
 * Live preview for `OptionGroup`: a required tortilla as radios and extras as checkboxes up to
 * two, each pick with what it adds to the price.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { OptionGroup } from "@sdxc/ui/commerce/option-group";

/** The source the page shows. */
const CODE = `<form id="item-form" data-base="1150">
	<OptionGroup name="tortilla" title="Tortilla" hint="Pick one" required requiredLabel="Required"
		choices={[{ value: "corn", label: "Blue corn", price: 0 }, { value: "flour", label: "Flour", price: 50, priceLabel: "+$0.50" }]} />
	<OptionGroup name="extras" title="Extras" hint="Optional, up to 2" max={2} choices={extras} />
	<button type="submit">Add <output data-options-total>$11.50</output></button>
	<OptionsLive form="item-form" currency="USD" />
</form>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<form
			action="#add"
			mix={[
				raw({
					display: "grid",
					gap: "1.5rem",
					inlineSize: "100%",
					maxInlineSize: "24rem",
					paddingBlock: "1rem",
				}),
			]}
		>
			<OptionGroup
				name="tortilla"
				title="Tortilla"
				hint="Pick one"
				required
				requiredLabel="Required"
				defaultValue={["corn"]}
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
		</form>
	),
};
