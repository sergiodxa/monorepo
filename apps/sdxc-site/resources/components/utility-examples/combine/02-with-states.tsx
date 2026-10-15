/**
 * A `combine` example grouping state utilities: a button's hover and pressed styles kept
 * together in one mixin, each selector kept apart inside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, fg } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { combine } from "@sdxc/u/general";
import { p } from "@sdxc/u/size";
import { active, hover } from "@sdxc/u/state";
import { scale } from "@sdxc/u/transform";
import { weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** A button whose hover and pressed feedback come from one combined mixin. */
export default {
	title: "Grouping states",
	description:
		"State utilities combine too, so a control's whole interaction can live in one mixin. Hover and press the button to try it:",
	render: () => (
		<button
			mix={[
				p(2, 4),
				rounded("md"),
				weight("medium"),
				border({ color: "neutral.border", width: 1, style: "solid" }),
				fg(),
				bg(),
				transition("background-color, transform"),
				combine([hover(bg("neutral.tint")), active(scale(0.96))]),
			]}
		>
			Add to cart
		</button>
	),
} satisfies UtilityExampleModule;
