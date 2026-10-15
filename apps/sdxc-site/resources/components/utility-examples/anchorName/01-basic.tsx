/**
 * The opening `anchorName` example: a button declares an anchor name and a tooltip
 * attaches to it by that name, with the browser keeping the two together.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import {
	absolute,
	anchorName,
	center,
	positionAnchor,
	positionArea,
	relative,
} from "sdxc/u/layout";
import { bs, is, mbe, p } from "sdxc/u/size";
import { text } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A button named as an anchor, and a tooltip positioned against it by that name. */
export default {
	title: "Basic example",
	description:
		"Use `anchorName(name)` on the element other elements position against, then point them at it with `positionAnchor(name)`:",
	render: () => (
		<div mix={[relative(), center(), is(72), bs(32)]}>
			<button mix={[anchorName("help-button"), demo.button()]}>Help</button>
			<div
				mix={[
					absolute(),
					positionAnchor("help-button"),
					positionArea("top"),
					mbe(2),
					p(1, 2),
					rounded("md"),
					bg("neutral.solid"),
					fg("neutral.onSolid"),
					text("xs"),
				]}
			>
				Opens the docs
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
