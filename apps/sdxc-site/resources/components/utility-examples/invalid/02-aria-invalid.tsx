/**
 * An `invalid` example driven by `aria-invalid`, the attribute a server-rendered form sets
 * after a failed submission, so the reader sees the error look without typing anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { invalid } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The same rule matches the ARIA attribute, so a server-flagged field needs no extra class. */
export default {
	title: "ARIA invalid",
	description: '`invalid()` also matches `aria-invalid="true"`, for a field the server rejected:',
	render: () => (
		<label mix={[vstack({ gap: 1 }), text("sm"), weight("medium")]}>
			Username
			<input
				type="text"
				value="admin"
				aria-invalid="true"
				aria-describedby="username-error"
				mix={[
					border("neutral.border"),
					invalid([border("danger.strong"), fg("danger")]),
					demo.input(),
				]}
			/>
			<span id="username-error" mix={[fg("danger"), text("xs")]}>
				That username is taken.
			</span>
		</label>
	),
} satisfies UtilityExampleModule;
