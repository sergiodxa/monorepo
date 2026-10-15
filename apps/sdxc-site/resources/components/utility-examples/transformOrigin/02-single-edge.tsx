/**
 * A `transformOrigin` example scaling from single edges, the pivot behind a bar that
 * grows from one side or a panel that unfolds from its top.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scale, transformOrigin } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Scaling anchored to one edge with an edge keyword. */
export default {
	title: "Growing from an edge",
	description:
		'Pass a single edge, like `transformOrigin("left")`, and the element scales toward or away from that side:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[scale(0.6), transformOrigin("left"), demo.tile()]}>left</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[scale(0.6), transformOrigin("top"), demo.tile()]}>top</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[scale(0.6), transformOrigin("bottom"), demo.tile()]}>bottom</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
