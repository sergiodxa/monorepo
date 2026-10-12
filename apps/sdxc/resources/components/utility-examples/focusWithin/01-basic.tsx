/**
 * The opening `focusWithin` example: a search box whose frame lights up while the field
 * inside it holds focus, so the reader sees a parent react to a child's focus.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { hstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { focusWithin } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A brand border and ring drawn on the wrapper whenever its input is focused. */
export default {
	title: "Basic example",
	description:
		"Use `focusWithin()` to style an element while it or anything inside it has focus. Click into the field:",
	render: () => (
		<label
			mix={[
				hstack({ gap: 2, align: "center" }),
				p(2, 3),
				rounded("md"),
				bg(),
				border({ color: "neutral.border", width: 1 }),
				focusWithin([border("brand.strong"), outline({ color: "brand", width: 2 })]),
			]}
		>
			<span mix={[demo.caption()]}>Search</span>
			<input
				type="search"
				placeholder="Packages, utilities…"
				mix={[border("none"), outline("none"), text("sm"), bg("transparent")]}
			/>
		</label>
	),
} satisfies UtilityExampleModule;
