/**
 * A `when` example with an at-rule instead of a selector, gating a hover effect behind
 * `@media (hover: hover)` so touch screens never get a hover state stuck on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { cursor } from "@sdxc/u/general";
import { hover, when } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The darker hover background applies only on devices whose primary pointer can hover. */
export default {
	title: "At-rules",
	description:
		"`when()` also takes an at-rule like `@media`. Nest `hover()` in it so the hover style only applies where a pointer can hover:",
	render: () => (
		<button
			type="button"
			mix={[
				bg("brand.solid"),
				fg("brand.onSolid"),
				when("@media (hover: hover)", hover(bg("color.brand.800"))),
				cursor("pointer"),
				demo.control(),
			]}
		>
			Hover me
		</button>
	),
} satisfies UtilityExampleModule;
