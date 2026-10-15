/**
 * The opening `not` example: buttons that react to the pointer only while they are not
 * disabled, so the reader hovers both and sees the disabled one stay still.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "sdxc/u/color";
import { opacity } from "sdxc/u/effects";
import { cursor } from "sdxc/u/general";
import { disabled, hover, not } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A darker hover background scoped to enabled buttons by nesting `hover()` inside `not()`. */
export default {
	title: "Basic example",
	description:
		"Pass a selector to `not()` to apply utilities everywhere that selector does not match. Hover both buttons:",
	render: () => (
		<div mix={[demo.row()]}>
			<button
				type="button"
				mix={[
					bg("brand.solid"),
					fg("brand.onSolid"),
					not(":disabled", [hover(bg("color.brand.800")), cursor("pointer")]),
					disabled(opacity(50)),
					demo.control(),
				]}
			>
				Archive
			</button>
			<button
				type="button"
				disabled
				mix={[
					bg("brand.solid"),
					fg("brand.onSolid"),
					not(":disabled", [hover(bg("color.brand.800")), cursor("pointer")]),
					disabled(opacity(50)),
					demo.control(),
				]}
			>
				Archive
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
