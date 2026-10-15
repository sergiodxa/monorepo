/**
 * A `positionAnchor` example with a popover: a menu in the top layer, opened by its
 * button with no script, that still opens right under the button it belongs to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack, anchorName, inset, positionAnchor, positionArea } from "sdxc/u/layout";
import { m, mbs } from "sdxc/u/size";
import { open } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A popover tethers to its trigger across the top layer through the anchor name. */
export default {
	title: "Anchoring a popover",
	description:
		"Anchor a popover to its trigger the same way, so a menu opened with `popovertarget` lands next to the button. Click the button to open it:",
	render: () => (
		<div>
			<button
				type="button"
				popovertarget="options-menu"
				mix={[anchorName("options"), demo.button()]}
			>
				Options
			</button>
			<div
				id="options-menu"
				popover
				mix={[
					positionAnchor("options"),
					positionArea("bottom span-right"),
					inset("auto"),
					m(0),
					mbs(2),
					open(vstack({ gap: 1, align: "start" })),
					demo.card(),
				]}
			>
				<span>Rename</span>
				<span>Duplicate</span>
				<span>Delete</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
