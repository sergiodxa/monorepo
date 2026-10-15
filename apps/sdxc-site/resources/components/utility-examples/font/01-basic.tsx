/**
 * The opening `font` example: the same sentence in each of the three named families, so
 * a reader compares the sans, serif and mono stacks the theme resolves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { font, text } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One sentence in the sans, serif and mono families. */
export default {
	title: "Basic example",
	description:
		'Use `font("sans")`, `font("serif")` or `font("mono")` to set the font family of an element:',
	render: () => (
		<div mix={[demo.stack()]}>
			<div>
				<p mix={[demo.caption()]}>font("sans")</p>
				<p mix={[font("sans"), text("xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>font("serif")</p>
				<p mix={[font("serif"), text("xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>font("mono")</p>
				<p mix={[font("mono"), text("xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
