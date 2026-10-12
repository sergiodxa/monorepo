/**
 * A `shrink` example with factors: three items with one basis, where the item with twice
 * the factor gives up twice the room.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { basis, flex, gap, shrink } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Items shrink in proportion to their factor when the row overflows. */
export default {
	title: "Shrinking in proportion",
	description:
		"Pass a factor like `shrink(2)` to shrink items in proportion to each other when they overflow the row:",
	align: "stretch",
	render: () => (
		<div mix={[flex(), gap(4), is("full")]}>
			<div mix={[shrink(1), basis(64), demo.block()]}>shrink(1)</div>
			<div mix={[shrink(2), basis(64), demo.block()]}>shrink(2)</div>
			<div mix={[shrink(1), basis(64), demo.block()]}>shrink(1)</div>
		</div>
	),
} satisfies UtilityExampleModule;
