/**
 * The opening `tracking` example: one sentence at four steps of the tracking scale, each
 * labelled with the call that set the space between its letters.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { text, tracking } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One sentence at the tight, normal, wide and widest steps of the tracking scale. */
export default {
	title: "Basic example",
	description:
		'Use `tracking(name)` with a step of the tracking scale, like `tracking("tight")` or `tracking("wide")`, to set the letter spacing of an element:',
	render: () => (
		<div mix={[demo.stack()]}>
			<div>
				<p mix={[demo.caption()]}>tracking("tight")</p>
				<p mix={[tracking("tight"), text("xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>tracking("normal")</p>
				<p mix={[tracking("normal"), text("xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>tracking("wide")</p>
				<p mix={[tracking("wide"), text("xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>tracking("widest")</p>
				<p mix={[tracking("widest"), text("xl")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
