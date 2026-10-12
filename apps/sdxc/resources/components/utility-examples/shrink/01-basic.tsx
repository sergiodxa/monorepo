/**
 * The opening `shrink` example: a row too narrow for its items, where the two fixed
 * slots keep their size and the middle item gives up the room.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { basis, flex, gap, shrink } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Fixed slots hold their basis while the flexible item between them shrinks. */
export default {
	title: "Basic example",
	description:
		"Use `shrink()` to keep a flex item at its size when the row runs out of room, so its siblings shrink instead:",
	align: "stretch",
	render: () => (
		<div mix={[flex(), gap(4), is("full")]}>
			<div mix={[shrink(), basis(36), demo.block()]}>shrink()</div>
			<div mix={[basis(96), demo.block()]}>shrinks</div>
			<div mix={[shrink(), basis(36), demo.block()]}>shrink()</div>
		</div>
	),
} satisfies UtilityExampleModule;
