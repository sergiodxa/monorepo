/**
 * A `scaleX` example with `-1`, which mirrors an element left to right: the usual way to
 * point a directional icon the other way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scaleX } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A horizontal mirror from a factor of -1. */
export default {
	title: "Mirroring horizontally",
	description:
		"Use `scaleX(-1)` to flip an element left to right, like pointing an arrow the other way:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[scaleX(1), demo.tile()]}>→ arrow</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[scaleX(-1), demo.tile()]}>→ arrow</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
