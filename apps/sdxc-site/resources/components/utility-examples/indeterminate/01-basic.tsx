/**
 * The opening `indeterminate` example: a "select all" box in the mixed state above a
 * partly ticked list, so the reader sees the third look the wrapper paints.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border } from "sdxc/u/color";
import { rounded } from "sdxc/u/effects";
import { hstack, vstack } from "sdxc/u/layout";
import { bs, is } from "sdxc/u/size";
import { checked, indeterminate } from "sdxc/u/state";
import { text, weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** Unchecked, checked and mixed boxes, told apart by their `aria-checked` value. */
export default {
	title: "Basic example",
	description:
		'Wrap utilities in `indeterminate()` to style a checkbox that is neither on nor off, like a "select all" whose list is partly ticked:',
	render: () => (
		<ul mix={[vstack({ gap: 2 }), text("sm")]}>
			<li mix={[hstack({ gap: 2, align: "center" }), weight("semibold")]}>
				<span
					role="checkbox"
					aria-checked="mixed"
					mix={[
						is(4),
						bs(4),
						rounded("sm"),
						border({ color: "neutral.strong", width: 2 }),
						indeterminate([bg("warning.solid"), border("warning.solid")]),
					]}
				/>
				All files
			</li>
			<li mix={[hstack({ gap: 2, align: "center" })]}>
				<span
					role="checkbox"
					aria-checked="true"
					mix={[
						is(4),
						bs(4),
						rounded("sm"),
						border({ color: "neutral.strong", width: 2 }),
						checked([bg("brand.solid"), border("brand.solid")]),
					]}
				/>
				report.pdf
			</li>
			<li mix={[hstack({ gap: 2, align: "center" })]}>
				<span
					role="checkbox"
					aria-checked="false"
					mix={[is(4), bs(4), rounded("sm"), border({ color: "neutral.strong", width: 2 })]}
				/>
				notes.txt
			</li>
		</ul>
	),
} satisfies UtilityExampleModule;
