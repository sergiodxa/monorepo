/**
 * A `gridTemplate` example with tracks of different sizes, mixing a fixed sidebar width
 * with fractions of what is left.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Grid columns of different sizes from one track list. */
export default {
	title: "Sizing tracks differently",
	description:
		'Write any track list, like `"8rem 2fr 1fr"`, to mix fixed lengths with fractions of the remaining space:',
	align: "stretch",
	render: () => (
		<div mix={[grid(), gridTemplate({ columns: "8rem 2fr 1fr" }), gap(4)]}>
			<div mix={[demo.block()]}>8rem</div>
			<div mix={[demo.block()]}>2fr</div>
			<div mix={[demo.block()]}>1fr</div>
		</div>
	),
} satisfies UtilityExampleModule;
