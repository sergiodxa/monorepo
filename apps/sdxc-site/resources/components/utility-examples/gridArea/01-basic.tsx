/**
 * The only `gridArea` example: a page layout drawn as named areas, with each region
 * placed by the name of the area it fills.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridArea, gridTemplate } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A page layout whose regions are placed into named grid areas. */
export default {
	title: "Basic example",
	description:
		"Use `gridArea(name)` to place an element in an area named by its grid's `gridTemplate({ areas })`:",
	align: "stretch",
	render: () => (
		<div
			mix={[
				grid(),
				gridTemplate({
					columns: "10rem 1fr",
					rows: "auto 8rem auto",
					areas: '"header header" "sidebar main" "footer footer"',
				}),
				gap(4),
			]}
		>
			<header mix={[gridArea("header"), demo.block()]}>header</header>
			<aside mix={[gridArea("sidebar"), demo.block()]}>sidebar</aside>
			<main mix={[gridArea("main"), demo.block()]}>main</main>
			<footer mix={[gridArea("footer"), demo.block()]}>footer</footer>
		</div>
	),
} satisfies UtilityExampleModule;
