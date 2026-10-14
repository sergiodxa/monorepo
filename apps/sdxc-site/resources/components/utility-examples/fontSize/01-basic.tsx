/**
 * The opening `fontSize` example: the same sentence at five steps of the text scale, each
 * labelled with the call that set it, the way a type specimen reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fontSize } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One sentence at the small through extra-large steps of the text scale. */
export default {
	title: "Basic example",
	description:
		'Use `fontSize(name)` with a step of the text scale, like `fontSize("sm")` or `fontSize("2xl")`, to set the font size of an element:',
	render: () => (
		<div mix={[demo.stack()]}>
			<div>
				<p mix={[demo.caption()]}>fontSize("sm")</p>
				<p mix={[fontSize("sm")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>fontSize("base")</p>
				<p mix={[fontSize("base")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>fontSize("lg")</p>
				<p mix={[fontSize("lg")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>fontSize("xl")</p>
				<p mix={[fontSize("xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>fontSize("2xl")</p>
				<p mix={[fontSize("2xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
