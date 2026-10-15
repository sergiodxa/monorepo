/**
 * The `textTransform` example: one sentence written in plain case and displayed upper,
 * lower and capitalised, so the source text stays as it was typed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { textTransform } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One sentence displayed in four cases. */
export default {
	title: "Basic example",
	description:
		'Use `textTransform("uppercase")`, `textTransform("lowercase")` or `textTransform("capitalize")` to change how text is cased on screen, and `textTransform("none")` to keep it as written:',
	render: () => (
		<div mix={[demo.stack()]}>
			<div>
				<p mix={[demo.caption()]}>textTransform("none")</p>
				<p mix={[textTransform("none")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>textTransform("uppercase")</p>
				<p mix={[textTransform("uppercase")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>textTransform("lowercase")</p>
				<p mix={[textTransform("lowercase")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
			<div>
				<p mix={[demo.caption()]}>textTransform("capitalize")</p>
				<p mix={[textTransform("capitalize")]}>The quick brown fox jumps over the lazy dog.</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
