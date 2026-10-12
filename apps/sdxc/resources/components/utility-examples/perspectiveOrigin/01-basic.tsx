/**
 * The opening `perspectiveOrigin` example: the same swung tile seen from three vanishing
 * points, so the reader sees the viewer move rather than the tile.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { perspective, perspectiveOrigin, rotateY } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The vanishing point moved with corner and centre keywords. */
export default {
	title: "Basic example",
	description:
		'Use `perspectiveOrigin()` beside `perspective()` on the parent to move the vanishing point, like `perspectiveOrigin("top left")`:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[perspective(250), perspectiveOrigin("top left"), demo.track()]}>
				<div mix={[rotateY(45), demo.tile()]}>top left</div>
			</div>
			<div mix={[perspective(250), perspectiveOrigin("center"), demo.track()]}>
				<div mix={[rotateY(45), demo.tile()]}>center</div>
			</div>
			<div mix={[perspective(250), perspectiveOrigin("bottom right"), demo.track()]}>
				<div mix={[rotateY(45), demo.tile()]}>bottom right</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
