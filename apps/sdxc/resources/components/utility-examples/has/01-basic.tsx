/**
 * The opening `has` example: plan cards that highlight themselves when the radio inside
 * them is checked, so the reader picks a plan and sees a parent follow its child's state.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { accent, bg, border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { has } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A brand border and tint on whichever card holds the checked radio. */
export default {
	title: "Basic example",
	description:
		"Pass a selector to `has()` to style an element by what it contains, like a card holding a checked radio. Pick a plan:",
	render: () => (
		<div mix={[demo.row()]}>
			<label
				mix={[
					hstack({ gap: 2, align: "center" }),
					p(3, 4),
					rounded("lg"),
					border({ color: "neutral.border", width: 2 }),
					has("input:checked", [border("brand"), bg("brand.tint")]),
					cursor("pointer"),
				]}
			>
				<input type="radio" name="has-plan" checked mix={[accent()]} />
				<span mix={[text("sm"), weight("semibold")]}>Starter</span>
			</label>
			<label
				mix={[
					hstack({ gap: 2, align: "center" }),
					p(3, 4),
					rounded("lg"),
					border({ color: "neutral.border", width: 2 }),
					has("input:checked", [border("brand"), bg("brand.tint")]),
					cursor("pointer"),
				]}
			>
				<input type="radio" name="has-plan" mix={[accent()]} />
				<span mix={[text("sm"), weight("semibold")]}>Team</span>
			</label>
		</div>
	),
} satisfies UtilityExampleModule;
