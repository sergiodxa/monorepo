/**
 * The opening `scroll` example: a photograph larger than its frame in both directions,
 * so a reader sees one call make the frame scroll along either axis.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border } from "@sdxc/u/color";
import { scroll } from "@sdxc/u/overflow";
import { bs, is, maxIs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A scroll container along both axes. */
export default {
	title: "Basic example",
	description:
		"Use `scroll()` to turn an element into a scroll container that shows a scrollbar only on an axis its content overflows. Scroll the photo in any direction:",
	render: () => (
		<div
			mix={[scroll(), is(72), maxIs("100%"), bs(40), border({ color: "neutral.border", width: 1 })]}
		>
			<div mix={[is(160), bs(96), demo.photo()]} />
		</div>
	),
} satisfies UtilityExampleModule;
