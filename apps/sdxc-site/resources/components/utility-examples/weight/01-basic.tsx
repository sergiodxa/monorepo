/**
 * The opening `weight` example: one sentence at five named weights, each labelled with the
 * call that set it, the way a type specimen reads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { text, weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One sentence at the light through bold weights. */
export default {
	title: "Basic example",
	description:
		'Use `weight(name)`, like `weight("medium")` or `weight("bold")`, to set the font weight of an element:',
	render: () => (
		<div mix={[demo.stack()]}>
			<div>
				<p mix={[demo.caption()]}>weight("light")</p>
				<p mix={[weight("light"), text("xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>weight("normal")</p>
				<p mix={[weight("normal"), text("xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>weight("medium")</p>
				<p mix={[weight("medium"), text("xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>weight("semibold")</p>
				<p mix={[weight("semibold"), text("xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>weight("bold")</p>
				<p mix={[weight("bold"), text("xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
