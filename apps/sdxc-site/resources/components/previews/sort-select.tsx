/**
 * Live preview for `SortSelect`: a listing's order as a labelled select that submits the
 * filters form it names the moment a new order is picked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { SortSelect } from "@sdxc/ui/commerce/sort-select";

/** The source the page shows. */
const CODE = `<SortSelect
	form="filters"
	name="sort"
	value={sort}
	label="Sort by"
	options={[
		{ value: "featured", label: "Featured" },
		{ value: "new", label: "Newest" },
		{ value: "price-asc", label: "Price: low to high" },
		{ value: "price-desc", label: "Price: high to low" },
	]}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ paddingBlock: "1.5rem" })]}>
			<SortSelect
				name="sort"
				value="new"
				label="Sort by"
				options={[
					{ value: "featured", label: "Featured" },
					{ value: "new", label: "Newest" },
					{ value: "price-asc", label: "Price: low to high" },
					{ value: "price-desc", label: "Price: high to low" },
				]}
			/>
		</div>
	),
};
