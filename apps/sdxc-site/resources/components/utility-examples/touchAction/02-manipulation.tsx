/**
 * A `touchAction` example on buttons tapped in quick succession: a quantity stepper whose
 * repeated taps register as taps, with double-tap zoom turned off.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { touchAction } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { tabularNums, text } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A stepper whose buttons ignore double-tap zoom. */
export default {
	title: "Fast repeated taps",
	description:
		'Use `touchAction("manipulation")` on controls people tap quickly, so a double tap counts twice instead of zooming the page:',
	render: () => (
		<div mix={[hstack({ gap: 4, align: "center" })]}>
			<button aria-label="Remove one" mix={[touchAction("manipulation"), demo.block()]}>
				−
			</button>
			<span mix={[tabularNums(), text("xl")]}>3</span>
			<button aria-label="Add one" mix={[touchAction("manipulation"), demo.block()]}>
				+
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
