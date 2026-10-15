/**
 * An `overflowAnchor` example with `auto`, re-enabling scroll anchoring on a subtree
 * whose ancestor turned it off.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { shrink, vstack } from "sdxc/u/layout";
import { overflowAnchor, scroll } from "sdxc/u/overflow";
import { bs, is, maxIs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A subtree that may hold the scroll position again. */
export default {
	title: "Restoring scroll anchoring",
	description:
		'Use `overflowAnchor("auto")` to let an element be chosen as the scroll anchor again inside a container that opted out:',
	render: () => (
		<div
			mix={[
				scroll("y"),
				overflowAnchor(),
				vstack({ gap: 3 }),
				bs(48),
				is(72),
				maxIs("100%"),
				demo.panel(),
			]}
		>
			<div mix={[shrink(), demo.block()]}>Header</div>
			<article mix={[overflowAnchor("auto"), shrink(), bs(32), demo.block()]}>
				The message being read
			</article>
			<div mix={[shrink(), demo.block()]}>Footer</div>
		</div>
	),
} satisfies UtilityExampleModule;
