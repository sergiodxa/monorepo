/**
 * A `transformOrigin` example with percentages and lengths, which pass through
 * unchanged, for a pivot outside the element or between the keyword points.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rotate, transformOrigin } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The pivot placed with percentages and lengths. */
export default {
	title: "Using custom values",
	description:
		'Pass any CSS position, like `transformOrigin("25% 75%")` or `transformOrigin("-1rem -1rem")`, to place the pivot exactly, even outside the element:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[rotate(20), transformOrigin("25% 75%"), demo.tile()]}>25% 75%</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[rotate(20), transformOrigin("-1rem -1rem"), demo.tile()]}>-1rem -1rem</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
