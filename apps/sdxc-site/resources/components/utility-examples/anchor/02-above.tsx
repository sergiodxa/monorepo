/**
 * An `anchor` example that measures the bottom inset from the anchor's top edge, which is
 * how a tooltip or a popover opens above the control it describes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { absolute, anchor, anchorName, center, insBe, insIs, relative } from "@sdxc/u/layout";
import { bs, is, mbe, p } from "@sdxc/u/size";
import { nowrap, text } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A tooltip opening above its button, its bottom edge pinned to the button's top. */
export default {
	title: "Placing above the anchor",
	description:
		'Pin the block-end edge to the anchor\'s `"top"` with `insBe(anchor(name, "top"))` to open the element above it:',
	render: () => (
		<div mix={[relative(), center(), is(72), bs(32)]}>
			<button mix={[anchorName("publish-button"), demo.button()]}>Publish</button>
			<div
				mix={[
					absolute(),
					insBe(anchor("publish-button", "top")),
					insIs(anchor("publish-button", "start")),
					mbe(2),
					p(1, 2),
					rounded("md"),
					bg("neutral.solid"),
					fg("neutral.onSolid"),
					text("xs"),
					nowrap(),
				]}
			>
				Visible to everyone
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
