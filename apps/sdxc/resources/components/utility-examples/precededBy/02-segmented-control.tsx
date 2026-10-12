/**
 * A `precededBy` example building a segmented control from visually hidden radios, each
 * segment painted from the radio before it in its own label, so focus and selection stay
 * native.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, border, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { precededBy } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The segment after the checked radio fills; the one after a keyboard-focused radio rings. */
export default {
	title: "Custom radio buttons",
	description:
		"Hide each radio and paint the text after it with `precededBy()`, one pair per label. Click a segment, or tab in and use the arrow keys:",
	render: () => (
		<fieldset
			mix={[hstack({ gap: 1 }), p(1), rounded("lg"), border({ color: "neutral.border", width: 1 })]}
		>
			<label>
				<input type="radio" name="view" checked mix={[visuallyHidden()]} />
				<span
					mix={[
						fg("neutral.muted"),
						cursor("pointer"),
						precededBy("input:checked", [bg("brand.solid"), fg("brand.onSolid")]),
						precededBy("input:focus-visible", outline({ color: "brand", offset: 2 })),
						demo.control(),
					]}
				>
					List
				</span>
			</label>
			<label>
				<input type="radio" name="view" mix={[visuallyHidden()]} />
				<span
					mix={[
						fg("neutral.muted"),
						cursor("pointer"),
						precededBy("input:checked", [bg("brand.solid"), fg("brand.onSolid")]),
						precededBy("input:focus-visible", outline({ color: "brand", offset: 2 })),
						demo.control(),
					]}
				>
					Grid
				</span>
			</label>
		</fieldset>
	),
} satisfies UtilityExampleModule;
