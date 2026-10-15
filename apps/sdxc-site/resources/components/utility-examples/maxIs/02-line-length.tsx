/**
 * A `maxIs` example capping a paragraph in `ch`, the unit that keeps a line of text at a
 * comfortable reading length.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { maxIs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A readable line length from a `ch` cap. */
export default {
	title: "Readable line length",
	description:
		'Pass any CSS length as a string, like `maxIs("45ch")`, to keep lines of text at a comfortable length:',
	render: () => (
		<p mix={[maxIs("45ch"), demo.prose()]}>
			Margins, padding and sizes in this package follow the writing mode, so a layout written once
			reads correctly in every language. A card padded on its inline start keeps that padding where
			a sentence begins, whichever side of the screen that is, and the same holds for a list, a
			sidebar or a toolbar.
		</p>
	),
} satisfies UtilityExampleModule;
