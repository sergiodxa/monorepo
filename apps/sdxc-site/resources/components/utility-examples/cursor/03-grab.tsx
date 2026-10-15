/**
 * A `cursor` example for something draggable: an open hand over a card that closes into a
 * fist while the button is held down.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cursor } from "sdxc/u/general";
import { active } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A card that shows a grabbing hand while pressed. */
export default {
	title: "Draggable items",
	description:
		'Use `cursor("grab")` with `active(cursor("grabbing"))` on something the reader can drag. Press and hold the card:',
	render: () => (
		<div mix={[cursor("grab"), active(cursor("grabbing")), demo.card()]}>
			Design review · Thursday 14:00
		</div>
	),
} satisfies UtilityExampleModule;
