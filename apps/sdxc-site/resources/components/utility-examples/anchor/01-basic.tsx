/**
 * The opening `anchor` example: a tooltip whose insets read the edges of the button it
 * belongs to, so it sits under the button wherever the button is laid out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { absolute, anchor, anchorName, center, insBs, insIs, relative } from "@sdxc/u/layout";
import { bs, is, mbs, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A tooltip pinned below its button by reading the button's edges with `anchor()`. */
export default {
	title: "Basic example",
	description:
		"Use `anchor(name, side)` as an inset value to pin an edge of a positioned element to a side of the element named by `anchorName()`:",
	render: () => (
		<div mix={[relative(), center(), is(72), bs(32)]}>
			<button mix={[anchorName("save-button"), demo.button()]}>Save</button>
			<div
				mix={[
					absolute(),
					insBs(anchor("save-button", "bottom")),
					insIs(anchor("save-button", "start")),
					mbs(2),
					p(1, 2),
					rounded("md"),
					bg("neutral.solid"),
					fg("neutral.onSolid"),
					text("xs"),
				]}
			>
				⌘S
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
