/**
 * The opening `placeholder` example: a field whose hint text is set in the muted tone
 * and italics, so the reader sees the placeholder styled apart from typed text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { placeholder } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Muted, italic placeholder text that gives way to the field's normal text on input. */
export default {
	title: "Basic example",
	description:
		"Wrap utilities in `placeholder()` to style a field's placeholder text. Type in the field to see your text replace it:",
	render: () => (
		<input
			type="text"
			placeholder="Search the docs…"
			mix={[
				border("neutral.border"),
				placeholder([fg("brand.muted"), raw({ fontStyle: "italic" })]),
				demo.input(),
			]}
		/>
	),
} satisfies UtilityExampleModule;
