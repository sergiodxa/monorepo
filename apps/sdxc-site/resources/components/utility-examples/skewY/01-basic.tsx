/**
 * The opening `skewY` example: tiles slanted along the vertical axis by growing angles,
 * over striped ghosts of their unslanted box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { skewY } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Vertical skew in degrees from a bare number. */
export default {
	title: "Basic example",
	description:
		"Use `skewY(n)` with a number of degrees to slant an element along its vertical axis:",
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[demo.track()]}>
				<div mix={[skewY(6), demo.tile()]}>skewY(6)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[skewY(12), demo.tile()]}>skewY(12)</div>
			</div>
			<div mix={[demo.track()]}>
				<div mix={[skewY(24), demo.tile()]}>skewY(24)</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
