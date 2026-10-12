/**
 * The opening `text` example: the same sentence at five steps of the text scale, each
 * set with the size and the line height that step pairs with it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { text } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One sentence at the small through extra-large steps of the text scale. */
export default {
	title: "Basic example",
	description:
		'Use `text(name)` with a step of the text scale, like `text("sm")` or `text("xl")`, to set an element\'s font size together with its line height:',
	render: () => (
		<div mix={[demo.stack()]}>
			<div>
				<p mix={[demo.caption()]}>text("sm")</p>
				<p mix={[text("sm")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>text("base")</p>
				<p mix={[text("base")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>text("lg")</p>
				<p mix={[text("lg")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>text("xl")</p>
				<p mix={[text("xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>text("2xl")</p>
				<p mix={[text("2xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
