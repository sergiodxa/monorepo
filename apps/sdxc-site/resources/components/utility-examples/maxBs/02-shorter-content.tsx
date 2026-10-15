/**
 * A `maxBs` example with content on both sides of the cap: the short box keeps its own
 * size, and the box asking for more is held at the cap.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "sdxc/u/layout";
import { bs, is, maxBs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A cap limits a box only when it asks for more. */
export default {
	title: "Content shorter than the cap",
	description:
		"A maximum only limits: an element shorter than `maxBs(24)` keeps its own size, and one asking for more stops at the cap:",
	render: () => (
		<div mix={[hstack({ gap: 4, align: "start" })]}>
			<div mix={[maxBs(24), bs(12), is(40), demo.cell()]}>bs(12)</div>
			<div mix={[maxBs(24), bs(48), is(40), demo.cell()]}>bs(48)</div>
		</div>
	),
} satisfies UtilityExampleModule;
