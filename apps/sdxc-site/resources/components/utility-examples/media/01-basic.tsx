/**
 * The opening `media` example: a grid that goes from one column to three once the
 * viewport is wide enough, the case where the window rather than a container decides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { gap, grid, gridTemplate, repeat } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A layout change at a viewport width. */
export default {
	title: "Basic example",
	description:
		'Use `media(query, ...)` to apply utilities under any media query, like `media("(min-width: 48rem)", ...)` for the viewport width. Resize your browser window to see the grid change:',
	align: "stretch",
	render: () => (
		<div
			mix={[grid(), gap(4), media("(min-width: 48rem)", gridTemplate({ columns: repeat(3, 1) }))]}
		>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
