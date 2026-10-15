/**
 * The opening `precededBy` example: to-do items whose text is struck through once the
 * checkbox before them is ticked, so the reader sees a later sibling react.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { accent, fg } from "sdxc/u/color";
import { hstack, vstack } from "sdxc/u/layout";
import { precededBy } from "sdxc/u/state";
import { text, textDecoration } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** Muted, struck-through text after a checked checkbox. */
export default {
	title: "Basic example",
	description:
		"Pass a selector to `precededBy()` to style an element by a sibling that comes before it. Tick the tasks:",
	render: () => (
		<ul mix={[vstack({ gap: 2 }), text("sm")]}>
			<li>
				<label mix={[hstack({ gap: 2, align: "center" })]}>
					<input type="checkbox" checked mix={[accent()]} />
					<span
						mix={[
							fg(),
							precededBy("input:checked", [textDecoration("line-through"), fg("neutral.muted")]),
						]}
					>
						Write the tests
					</span>
				</label>
			</li>
			<li>
				<label mix={[hstack({ gap: 2, align: "center" })]}>
					<input type="checkbox" mix={[accent()]} />
					<span
						mix={[
							fg(),
							precededBy("input:checked", [textDecoration("line-through"), fg("neutral.muted")]),
						]}
					>
						Ship the release
					</span>
				</label>
			</li>
		</ul>
	),
} satisfies UtilityExampleModule;
