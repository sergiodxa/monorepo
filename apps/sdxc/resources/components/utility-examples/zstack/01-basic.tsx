/**
 * The opening `zstack` example: a caption laid over the bottom corner of a photograph,
 * both children sharing one grid cell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { zstack } from "@sdxc/u/layout";
import { bs, is, m } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Children overlap in one cell, placed inside it by the align and justify options. */
export default {
	title: "Basic example",
	description:
		"Use `zstack()` to stack children on top of each other, with `align` and `justify` placing them inside the shared cell:",
	render: () => (
		<div mix={[zstack({ align: "end", justify: "start" })]}>
			<div mix={[is(80), bs(48), demo.photo()]} />
			<div mix={[m(3), demo.block()]}>Lake Tahoe</div>
		</div>
	),
} satisfies UtilityExampleModule;
