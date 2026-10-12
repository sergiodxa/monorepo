/**
 * A `scrollbarGutter` example with `stable both-edges`, so the gutter is mirrored on
 * the start edge and the content stays centred in the box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scroll, scrollbarGutter } from "@sdxc/u/overflow";
import { bs, is, maxIs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A gutter reserved on both inline edges. */
export default {
	title: "Reserving both edges",
	description:
		'Pass `"stable both-edges"` to reserve the gutter on both sides, keeping content centred:',
	render: () => (
		<div
			mix={[
				scroll("y"),
				scrollbarGutter("stable both-edges"),
				bs(24),
				is(72),
				maxIs("100%"),
				demo.panel(),
			]}
		>
			<p mix={[demo.prose()]}>
				This paragraph is taller than its box, so the last lines of it do not fit. Scroll to read
				the rest, while the page around the box stays exactly where it is.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
