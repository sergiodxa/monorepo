/**
 * A `verticalAlign` example lowering and raising characters off the baseline, the way a
 * chemical formula and an exponent are written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fontSize, text, verticalAlign } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** A subscript in a formula and a superscript in an equation. */
export default {
	title: "Subscript and superscript",
	description:
		'Use `verticalAlign("sub")` and `verticalAlign("super")` to lower or raise text off the baseline:',
	render: () => (
		<p mix={[text("2xl")]}>
			Water is H<span mix={[verticalAlign("sub"), fontSize("sm")]}>2</span>O, and E = mc
			<span mix={[verticalAlign("super"), fontSize("sm")]}>2</span>.
		</p>
	),
} satisfies UtilityExampleModule;
