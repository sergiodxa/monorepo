/**
 * The opening `caretColor` example: two fields whose blinking caret is painted in a
 * tone, so the insertion point stands out from the text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { caretColor } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Text fields with a brand caret and a danger caret. */
export default {
	title: "Basic example",
	description:
		"Use `caretColor` with a tone to paint the blinking text cursor of a field. Click a field to see its caret:",
	render: () => (
		<div mix={[demo.stack()]}>
			<input
				type="text"
				value="Brand caret"
				mix={[caretColor("brand"), demo.field()]}
				aria-label="Brand caret"
			/>
			<input
				type="text"
				value="Danger caret"
				mix={[caretColor("danger"), demo.field()]}
				aria-label="Danger caret"
			/>
		</div>
	),
} satisfies UtilityExampleModule;
