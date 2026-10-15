/**
 * A `truncate` example inside a flex row: a contact's name and address shortened beside
 * an avatar, which works once the text column may shrink below its content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { hstack, shrink } from "@sdxc/u/layout";
import { circle, is, maxIs, minIs } from "@sdxc/u/size";
import { text, truncate, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A name and an email truncated next to an avatar in a narrow row. */
export default {
	title: "Inside a flex row",
	description:
		"A flex item refuses to shrink below its content, so give the text column `minIs(0)` for `truncate()` to have an edge to cut at:",
	render: () => (
		<div mix={[hstack({ gap: 3, align: "center" }), maxIs(64), demo.panel()]}>
			<div mix={[is(10), shrink(0), circle(), bg("brand.solid")]} />
			<div mix={[minIs(0)]}>
				<p mix={[truncate(), weight("semibold")]}>Alexandra Montgomery-Whitfield</p>
				<p mix={[truncate(), text("sm"), fg("neutral.muted")]}>
					alexandra.montgomery-whitfield@example.com
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
