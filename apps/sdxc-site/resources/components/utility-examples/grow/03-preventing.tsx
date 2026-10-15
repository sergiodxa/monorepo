/**
 * A `grow(0)` example: the middle item keeps its content size while the items around it
 * share the rest of the row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, gap, grow } from "sdxc/u/layout";
import { is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A factor of zero keeps an item at its own size among growing siblings. */
export default {
	title: "Preventing items from growing",
	description: "Use `grow(0)` to keep an item at its own size while its siblings grow:",
	align: "stretch",
	render: () => (
		<div mix={[flex(), gap(4), is("full")]}>
			<div mix={[grow(), demo.block()]}>grow()</div>
			<div mix={[grow(0), demo.block()]}>grow(0)</div>
			<div mix={[grow(), demo.block()]}>grow()</div>
		</div>
	),
} satisfies UtilityExampleModule;
