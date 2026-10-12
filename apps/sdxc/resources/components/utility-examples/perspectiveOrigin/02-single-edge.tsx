/**
 * A `perspectiveOrigin` example with single edge keywords, which centre the other axis,
 * so the viewer moves along one axis only.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { perspective, perspectiveOrigin, rotateY } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The vanishing point moved along one axis with an edge keyword. */
export default {
	title: "Using an edge",
	description:
		'Pass a single edge, like `perspectiveOrigin("left")`, to move the vanishing point along one axis and centre it on the other:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[perspective(250), perspectiveOrigin("left"), demo.track()]}>
				<div mix={[rotateY(45), demo.tile()]}>left</div>
			</div>
			<div mix={[perspective(250), perspectiveOrigin("right"), demo.track()]}>
				<div mix={[rotateY(45), demo.tile()]}>right</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
