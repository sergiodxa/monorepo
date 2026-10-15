/**
 * The opening `translateX` example: tiles moved along the horizontal axis by steps of the
 * spacing scale, over striped ghosts of where they sat.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { translateX } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Horizontal translation from a step of the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `translateX(n)` with a step of the spacing scale, like `translateX(2)` or `translateX(6)`, to move an element horizontally:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[translateX(2), demo.tile()]}>translateX(2)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[translateX(6), demo.tile()]}>translateX(6)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
