/**
 * A `userSelect` example re-enabling selection inside an unselectable area: a contact card
 * that ignores drags except on the email address a reader may want to copy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { userSelect } from "@sdxc/u/general";
import { weight } from "@sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A card that resists selection except for the address inside it. */
export default {
	title: "Allowing selection inside",
	description:
		'Use `userSelect("text")` to make part of an unselectable area selectable again. Try selecting the name, then the email:',
	render: () => (
		<div mix={[userSelect(), demo.card()]}>
			<p mix={[weight("semibold")]}>Ada Lovelace</p>
			<p mix={[userSelect("text"), fg("brand")]}>ada@example.com</p>
		</div>
	),
} satisfies UtilityExampleModule;
