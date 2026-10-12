/**
 * The opening `translateY` example: tiles moved along the vertical axis by steps of the
 * spacing scale, over striped ghosts of where they sat.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { translateY } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Vertical translation from a step of the spacing scale. */
export default {
	title: "Basic example",
	description:
		"Use `translateY(n)` with a step of the spacing scale, like `translateY(2)` or `translateY(6)`, to move an element vertically:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[translateY(2), demo.tile()]}>translateY(2)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[translateY(6), demo.tile()]}>translateY(6)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
