/**
 * The opening `required` example: a required and an optional field side by side, the
 * required one marked by a heavier border, so the reader sees which one the form needs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { required } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A stronger border on the field that has the `required` attribute. */
export default {
	title: "Basic example",
	description: "Wrap utilities in `required()` to style a field the form cannot be sent without:",
	render: () => (
		<div mix={[demo.stack()]}>
			<label mix={[vstack({ gap: 1 }), text("sm"), weight("medium")]}>
				Full name (required)
				<input
					type="text"
					required
					mix={[border("neutral.border"), required(border("brand.strong")), demo.input()]}
				/>
			</label>
			<label mix={[vstack({ gap: 1 }), text("sm"), weight("medium")]}>
				Company (optional)
				<input
					type="text"
					mix={[border("neutral.border"), required(border("brand.strong")), demo.input()]}
				/>
			</label>
		</div>
	),
} satisfies UtilityExampleModule;
