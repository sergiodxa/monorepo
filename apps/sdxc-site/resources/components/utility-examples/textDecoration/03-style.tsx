/**
 * A `textDecoration` example with each line style, from the plain solid line to the wavy
 * one a spell checker draws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { text, textDecoration } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One sentence underlined in each of the five line styles. */
export default {
	title: "Decoration style",
	description:
		'Set `style` to `"solid"`, `"double"`, `"dotted"`, `"dashed"` or `"wavy"` to change how the line is drawn:',
	render: () => (
		<div mix={[demo.stack()]}>
			<p mix={[textDecoration({ line: "underline", style: "solid" }), text("xl")]}>
				The quick brown fox jumps over the lazy dog.
			</p>
			<p mix={[textDecoration({ line: "underline", style: "double" }), text("xl")]}>
				The quick brown fox jumps over the lazy dog.
			</p>
			<p mix={[textDecoration({ line: "underline", style: "dotted" }), text("xl")]}>
				The quick brown fox jumps over the lazy dog.
			</p>
			<p mix={[textDecoration({ line: "underline", style: "dashed" }), text("xl")]}>
				The quick brown fox jumps over the lazy dog.
			</p>
			<p mix={[textDecoration({ line: "underline", style: "wavy", color: "danger" }), text("xl")]}>
				The quick brown fox jumps over the lazy dog.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
