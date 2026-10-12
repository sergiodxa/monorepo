/**
 * A `bs` example filling its parent: a box at `"full"` beside a box at a fixed step,
 * inside a parent with a block size of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack } from "@sdxc/u/layout";
import { bs, is, p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** `"full"` fills the parent's block size. */
export default {
	title: "Filling the parent",
	description:
		'Use `bs("full")` to fill the block size of a parent that sets one, or pass any CSS length as a string, like `bs("50%")`:',
	render: () => (
		<div mix={[hstack({ gap: 4, align: "start" }), bs(48), p(4), demo.track()]}>
			<div mix={[bs("full"), is(28), demo.cell()]}>bs("full")</div>
			<div mix={[bs("50%"), is(28), demo.cell()]}>bs("50%")</div>
		</div>
	),
} satisfies UtilityExampleModule;
