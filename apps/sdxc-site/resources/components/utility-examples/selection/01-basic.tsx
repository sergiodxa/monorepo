/**
 * The opening `selection` example: a paragraph that paints selected text in the brand
 * colors, so the reader selects part of it to see the highlight change.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "sdxc/u/color";
import { selection } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A solid brand highlight with readable text on it, in place of the system's. */
export default {
	title: "Basic example",
	description:
		"Wrap utilities in `selection()` to style the text a user highlights. Select some of the paragraph:",
	render: () => (
		<p mix={[selection([bg("brand.solid"), fg("brand.onSolid")]), demo.prose()]}>
			Utilities compose: a state wrapper takes any of them, so the same few calls style a button at
			rest, under the pointer, and while it is pressed.
		</p>
	),
} satisfies UtilityExampleModule;
