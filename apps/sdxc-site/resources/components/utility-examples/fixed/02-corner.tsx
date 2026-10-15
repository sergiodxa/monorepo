/**
 * A `fixed` example pinning a notice to a bottom corner, the place toasts and chat
 * launchers sit, measured from the window's edges by two insets.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { contain, fixed, insBottom, insRight } from "sdxc/u/layout";
import { overflowY } from "sdxc/u/overflow";
import { bs, is, pbe, pbs, pi } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A toast pinned to the bottom corner of a scrolling window. */
export default {
	title: "Pinning to a corner",
	description:
		"Combine `fixed()` with `insBottom()` and `insRight()` to keep an element in a corner of the viewport, like a toast:",
	render: () => (
		<div mix={[contain("layout"), is(80), bs(36), demo.frame()]}>
			<div mix={[overflowY("auto"), bs("full"), pi(4), pbs(4), pbe(16)]}>
				<p mix={[demo.prose()]}>
					The toast keeps its corner while the rest of the window scrolls. Scroll this text to see
					it hold its place.
				</p>
				<p mix={[demo.prose()]}>
					Fixed elements are measured from the edges of the viewport, so two insets pick the corner.
				</p>
			</div>
			<div mix={[fixed(), insBottom(3), insRight(3), demo.block()]}>Saved</div>
		</div>
	),
} satisfies UtilityExampleModule;
