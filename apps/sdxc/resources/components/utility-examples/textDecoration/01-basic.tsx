/**
 * The opening `textDecoration` example: one sentence underlined, overlined and struck
 * through, each labelled with the line the call draws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { text, textDecoration } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One sentence with each of the three decoration lines. */
export default {
	title: "Basic example",
	description:
		'Use `textDecoration(line)` to draw a line on text: `textDecoration()` underlines, and `"overline"` and `"line-through"` draw above and across it:',
	render: () => (
		<div mix={[demo.stack()]}>
			<div>
				<p mix={[demo.caption()]}>textDecoration()</p>
				<p mix={[textDecoration(), text("xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>textDecoration("overline")</p>
				<p mix={[textDecoration("overline"), text("xl")]}>
					The quick brown fox jumps over the lazy dog.
				</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>textDecoration("line-through")</p>
				<p mix={[textDecoration("line-through"), text("xl")]}>
					The quick brown fox jumps over the lazy dog.
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
