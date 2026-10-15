/**
 * A `focusWithin` example on a whole form section, outlining the group a reader is filling
 * in, so focus moving between fields shows which section is current.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, outline } from "sdxc/u/color";
import { vstack } from "sdxc/u/layout";
import { focusWithin } from "sdxc/u/state";
import { text, weight } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Two fieldsets, each outlined while one of its own fields has focus. */
export default {
	title: "Highlighting a group",
	description:
		"Put `focusWithin()` on a container to mark the group being edited. Tab through the fields and watch the active section change:",
	render: () => (
		<div mix={[demo.stack()]}>
			<fieldset
				mix={[vstack({ gap: 2 }), focusWithin(outline({ color: "brand", width: 2 })), demo.panel()]}
			>
				<legend mix={[text("sm"), weight("semibold")]}>Shipping</legend>
				<input type="text" placeholder="Street" mix={[border("neutral.border"), demo.input()]} />
			</fieldset>
			<fieldset
				mix={[vstack({ gap: 2 }), focusWithin(outline({ color: "brand", width: 2 })), demo.panel()]}
			>
				<legend mix={[text("sm"), weight("semibold")]}>Billing</legend>
				<input
					type="text"
					placeholder="Card holder"
					mix={[border("neutral.border"), demo.input()]}
				/>
			</fieldset>
		</div>
	),
} satisfies UtilityExampleModule;
