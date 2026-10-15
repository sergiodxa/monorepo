/**
 * A `perspectiveOrigin` example with percentages and lengths, which pass through
 * unchanged, for a vanishing point outside the keyword grid.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { perspective, perspectiveOrigin, rotateY } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The vanishing point placed with percentages and lengths. */
export default {
	title: "Using custom values",
	description:
		'Pass any CSS position, like `perspectiveOrigin("25% 75%")` or `perspectiveOrigin("-4rem 0")`, to place the vanishing point exactly:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[perspective(250), perspectiveOrigin("25% 75%"), demo.track()]}>
				<div mix={[rotateY(45), demo.tile()]}>25% 75%</div>
			</div>
			<div mix={[perspective(250), perspectiveOrigin("-4rem 0"), demo.track()]}>
				<div mix={[rotateY(45), demo.tile()]}>-4rem 0</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
