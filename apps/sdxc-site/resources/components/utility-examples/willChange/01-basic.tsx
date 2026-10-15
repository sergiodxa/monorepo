/**
 * The opening `willChange` example: a card that scales up on hover, hinted ahead of time
 * so the browser can prepare the layer before the animation starts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition } from "sdxc/u/effects";
import { willChange } from "sdxc/u/general";
import { hover } from "sdxc/u/state";
import { scale } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A hover-scaled card hinted with the property it animates. */
export default {
	title: "Basic example",
	description:
		"Use `willChange(property)` to tell the browser which property is about to animate, so it can prepare before the change starts. Hover the card:",
	render: () => (
		<div mix={[willChange("transform"), transition("transform"), hover(scale(1.05)), demo.card()]}>
			Spring collection · 24 new pieces
		</div>
	),
} satisfies UtilityExampleModule;
