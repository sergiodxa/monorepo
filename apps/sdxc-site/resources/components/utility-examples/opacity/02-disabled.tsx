/**
 * An `opacity` example on a disabled control, its most common use, so the reader sees a
 * state fade a button that can't be pressed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { opacity } from "sdxc/u/effects";
import { disabled } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A disabled button faded to half opacity. */
export default {
	title: "Fading disabled controls",
	description: "Combine it with `disabled()` to fade a control while it can't be used:",
	render: () => (
		<div mix={[demo.row()]}>
			<button type="button" mix={[disabled(opacity(50)), demo.button()]}>
				Save
			</button>
			<button type="button" disabled mix={[disabled(opacity(50)), demo.button()]}>
				Save
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
