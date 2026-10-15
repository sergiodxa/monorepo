/**
 * The opening `textShadow` example: a heading with the default shadow and two deeper
 * ones, so the reader sees `y` and `blur` push the shadow further from the glyphs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { textShadow } from "sdxc/u/effects";
import { text, weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Text shadows of increasing depth on a heading. */
export default {
	title: "Basic example",
	description:
		"Use `textShadow()` to shadow the letters of an element, and pass `y` and `blur` to deepen it:",
	render: () => (
		<div mix={[demo.stack()]}>
			<p mix={[textShadow(), text("3xl"), weight("bold")]}>The quick brown fox</p>
			<p mix={[textShadow({ y: 1, blur: 3 }), text("3xl"), weight("bold")]}>The quick brown fox</p>
			<p mix={[textShadow({ y: 2, blur: 4 }), text("3xl"), weight("bold")]}>The quick brown fox</p>
		</div>
	),
} satisfies UtilityExampleModule;
