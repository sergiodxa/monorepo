/**
 * The opening `lineClamp` example: an article card whose summary stops after three lines
 * with an ellipsis, however long the text it was given.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { maxIs } from "@sdxc/u/size";
import { lineClamp, text, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A card summary clamped to three lines. */
export default {
	title: "Basic example",
	description:
		"Use `lineClamp(n)` to cut text off after a number of lines, ending the last one in an ellipsis:",
	render: () => (
		<article mix={[maxIs(80), demo.card()]}>
			<p mix={[text("sm"), fg("neutral.muted")]}>Mar 10, 2026 · Marketing</p>
			<h3 mix={[text("lg"), weight("semibold")]}>What we learned testing forty pricing pages</h3>
			<p mix={[lineClamp(3), fg("neutral.muted")]}>
				Most visitors leave a pricing page within ten seconds. We tested forty variations of ours
				over six months, and the changes that moved the number were not the ones we expected: fewer
				plans, a plainer headline, and a single button that said exactly what would happen next.
			</p>
		</article>
	),
} satisfies UtilityExampleModule;
