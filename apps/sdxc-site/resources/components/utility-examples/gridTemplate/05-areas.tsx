/**
 * A `gridTemplate` example with named areas, drawing the layout as rows of names that
 * the children then claim with `gridArea()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridArea, gridTemplate } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A layout drawn as named grid areas. */
export default {
	title: "Naming areas",
	description:
		"Pass `areas` to draw the layout as rows of names, then place each child into one with `gridArea()`:",
	align: "stretch",
	render: () => (
		<div
			mix={[
				grid(),
				gridTemplate({
					columns: "1fr 1fr 1fr",
					areas: '"hero hero aside" "one two aside"',
				}),
				gap(4),
			]}
		>
			<div mix={[gridArea("hero"), demo.block()]}>hero</div>
			<div mix={[gridArea("aside"), demo.block()]}>aside</div>
			<div mix={[gridArea("one"), demo.block()]}>one</div>
			<div mix={[gridArea("two"), demo.block()]}>two</div>
		</div>
	),
} satisfies UtilityExampleModule;
