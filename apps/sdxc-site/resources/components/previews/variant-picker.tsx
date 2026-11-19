/**
 * Live preview for `VariantPicker`: a poster's frame colours as swatches with one sold out,
 * its sizes as pills, and its formats as cards with a price or delivery line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { VariantPicker } from "@sdxc/ui/commerce/variant-picker";

/** The source the page shows. */
const CODE = `<VariantPicker target="product">
	<VariantPicker.Axis label="Frame" value={frame.name}>
		{frames.map((option) => (
			<VariantPicker.Swatch href={variantHref({ frame: option.id })} name={option.name} color={option.color} selected={option.id === frame.id} unavailable={!option.inStock} unavailableLabel="sold out" />
		))}
	</VariantPicker.Axis>
	<VariantPicker.Axis label="Size" value={size.label} aside={<a href="/size-guide">Size guide</a>}>
		{sizes.map((option) => (
			<VariantPicker.Choice href={variantHref({ size: option.id })} label={option.label} selected={option.id === size.id} />
		))}
	</VariantPicker.Axis>
	<VariantPicker.Axis label="Format" value={format.label}>
		<VariantPicker.Choice variant="card" href={variantHref({ format: "print" })} label="Print" detail="$45" selected />
		<VariantPicker.Choice variant="card" href={variantHref({ format: "digital" })} label="Digital" detail="Instant download" />
	</VariantPicker.Axis>
</VariantPicker>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", maxInlineSize: "22rem", paddingBlock: "1rem" })]}>
			<VariantPicker>
				<VariantPicker.Axis label="Frame" value="Oak">
					<VariantPicker.Swatch href="/examples/shop/oak" name="Oak" color="#b58a5a" selected />
					<VariantPicker.Swatch href="/examples/shop/black" name="Black" color="#1d1d1f" />
					<VariantPicker.Swatch
						href="/examples/shop/walnut"
						name="Walnut"
						color="#5b3a26"
						unavailable
						unavailableLabel="sold out"
					/>
				</VariantPicker.Axis>
				<VariantPicker.Axis
					label="Size"
					value="50×70"
					aside={<a href="/examples/shop/size-guide">Size guide</a>}
				>
					<VariantPicker.Choice href="/examples/shop/30x40" label="30×40" />
					<VariantPicker.Choice href="/examples/shop/50x70" label="50×70" selected />
					<VariantPicker.Choice
						href="/examples/shop/70x100"
						label="70×100"
						unavailable
						unavailableLabel="sold out"
					/>
				</VariantPicker.Axis>
				<VariantPicker.Axis label="Format" value="Print">
					<VariantPicker.Choice
						variant="card"
						href="/examples/shop/print"
						label="Print"
						detail="$45"
						selected
					/>
					<VariantPicker.Choice
						variant="card"
						href="/examples/shop/digital"
						label="Digital"
						detail="Instant download"
					/>
				</VariantPicker.Axis>
			</VariantPicker>
		</div>
	),
};
