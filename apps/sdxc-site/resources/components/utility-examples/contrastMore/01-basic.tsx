/**
 * The opening `contrastMore` example: muted helper text that switches to the emphasis
 * color when the reader asks their system for more contrast.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "sdxc/u/color";
import { vstack } from "sdxc/u/layout";
import { contrastMore } from "sdxc/u/responsive";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Muted text strengthened for a more-contrast preference. */
export default {
	title: "Basic example",
	description:
		"Use `contrastMore(...)` to apply utilities when the reader asks for more contrast. Turn on Increase contrast in your system's accessibility settings, or emulate `prefers-contrast: more` in your browser's dev tools, to see the hint darken:",
	render: () => (
		<label mix={[vstack({ gap: 2 }), demo.panel()]}>
			<span>Email</span>
			<input type="email" placeholder="you@example.com" mix={[demo.field()]} />
			<span mix={[fg("neutral.muted"), contrastMore(fg("neutral.emphasis"))]}>
				We never share it.
			</span>
		</label>
	),
} satisfies UtilityExampleModule;
