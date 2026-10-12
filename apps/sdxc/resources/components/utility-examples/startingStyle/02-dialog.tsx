/**
 * A `startingStyle` example on a modal dialog, which scales and fades in from its
 * starting values as it enters the top layer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { opacity, transition, transitionBehavior } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { startingStyle } from "@sdxc/u/responsive";
import { scaleProperty } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A dialog that scales and fades in on open. */
export default {
	title: "Animating a dialog in",
	description:
		"Pass several utilities to animate more than one property, like a dialog that grows into place. Open the dialog:",
	render: () => (
		<div>
			<button
				type="button"
				commandfor="starting-style-dialog"
				command="show-modal"
				mix={[bg("brand.solid"), fg("brand.onSolid"), cursor("pointer"), demo.control()]}
			>
				Open dialog
			</button>
			<dialog
				id="starting-style-dialog"
				mix={[
					opacity(100),
					scaleProperty(1),
					transition("opacity, scale, display, overlay", { duration: 300 }),
					transitionBehavior("allow-discrete"),
					startingStyle([opacity(0), scaleProperty(0.9)]),
					demo.card(),
				]}
			>
				<div mix={[vstack({ gap: 3 })]}>
					<p>Changes saved.</p>
					<button
						type="button"
						commandfor="starting-style-dialog"
						command="close"
						mix={[bg("neutral.tint"), fg("neutral.emphasis"), cursor("pointer"), demo.control()]}
					>
						Close
					</button>
				</div>
			</dialog>
		</div>
	),
} satisfies UtilityExampleModule;
