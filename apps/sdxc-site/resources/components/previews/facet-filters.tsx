/**
 * Live preview for `FacetFilters`: a poster shop's sidebar with the applied filters as
 * chips, colours with counts, an in-stock switch and a price range with buckets.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { FacetFilters } from "@sdxc/ui/commerce/facet-filters";

/** The source the page shows. */
const CODE = `<FacetFilters.Applied label="Applied filters" chips={applied.map((filter) => ({ label: filter.label, href: without(filter) }))} clear={{ label: "Clear all", href: "/shop" }} />
<FacetFilters action="/shop" keep={{ q, sort }} labels={{ apply: "Apply" }}>
	<FacetFilters.Group title="Colour">
		{colours.map((colour) => (
			<FacetFilters.Check name="colour" value={colour.id} label={colour.name} count={colour.count} swatch={colour.hex} checked={selected.has(colour.id)} />
		))}
	</FacetFilters.Group>
	<FacetFilters.Group title="Availability">
		<FacetFilters.Toggle name="in_stock" label="In stock" count={inStock} checked={onlyInStock} />
	</FacetFilters.Group>
	<FacetFilters.Group title="Price">
		<FacetFilters.Range minName="min" maxName="max" min={min} max={max} prefix="$" labels={{ min: "Min", max: "Max" }} buckets={buckets} />
	</FacetFilters.Group>
</FacetFilters>`;

/** The colours on offer and how many posters each has. */
const COLOURS = [
	{ id: "blue", name: "Blue", hex: "#3b6fd8", count: 24, checked: true },
	{ id: "orange", name: "Orange", hex: "#e07b39", count: 17, checked: false },
	{ id: "green", name: "Green", hex: "#3e8e5e", count: 0, checked: false },
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
					maxInlineSize: "16rem",
					paddingBlock: "1rem",
				}),
			]}
		>
			<FacetFilters.Applied
				label="Applied filters"
				chips={[
					{ label: "Blue", href: "/examples/shop?remove-blue" },
					{ label: "In stock", href: "/examples/shop?remove-stock" },
				]}
				clear={{ label: "Clear all", href: "/examples/shop?clear" }}
			/>
			<FacetFilters action="/examples/shop" labels={{ apply: "Apply" }}>
				<FacetFilters.Group title="Colour">
					{COLOURS.map((colour) => (
						<FacetFilters.Check
							name="colour"
							value={colour.id}
							label={colour.name}
							count={colour.count}
							swatch={colour.hex}
							checked={colour.checked}
						/>
					))}
				</FacetFilters.Group>
				<FacetFilters.Group title="Availability">
					<FacetFilters.Toggle name="in_stock" label="In stock" count={84} checked />
				</FacetFilters.Group>
				<FacetFilters.Group title="Price">
					<FacetFilters.Range
						minName="min"
						maxName="max"
						min={null}
						max={null}
						prefix="$"
						labels={{ min: "Min", max: "Max" }}
						buckets={[
							{ label: "Under $25", href: "/examples/shop?under-25", count: 12, selected: false },
							{ label: "$25 to $50", href: "/examples/shop?25-50", count: 31, selected: true },
							{ label: "Over $50", href: "/examples/shop?over-50", count: 8, selected: false },
						]}
					/>
				</FacetFilters.Group>
			</FacetFilters>
		</div>
	),
};
