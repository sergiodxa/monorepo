/**
 * A `placeholderShown` example building a floating label with no JavaScript: the label
 * sits inside the empty field and moves above it once the reader types or focuses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, fg } from "@sdxc/u/color";
import { transition } from "@sdxc/u/effects";
import { pointerEvents } from "@sdxc/u/general";
import { absolute, insIs, insTop, relative } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { placeholderShown, precededBy } from "@sdxc/u/state";
import { scale, transformOrigin, translateY } from "@sdxc/u/transform";
import { text } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The label shrinks and rises unless the field is both empty and unfocused. */
export default {
	title: "Floating label",
	description:
		"Give the field a blank placeholder so `placeholderShown()` means empty, then move the text after it with `precededBy()`. Click into the field:",
	render: () => (
		<label mix={[relative(), is(64)]}>
			<input
				type="text"
				placeholder=" "
				mix={[
					bg(),
					border("brand.strong"),
					placeholderShown(border("neutral.border")),
					is("100%"),
					demo.input(),
				]}
			/>
			<span
				mix={[
					absolute(),
					insTop(2),
					insIs(3),
					text("sm"),
					fg("neutral.muted"),
					pointerEvents("none"),
					transformOrigin("left"),
					transition("transform, color"),
					precededBy("input:not(:placeholder-shown), input:focus", [
						translateY(-6),
						scale(0.8),
						fg("brand"),
						bg(),
					]),
				]}
			>
				City
			</span>
		</label>
	),
} satisfies UtilityExampleModule;
