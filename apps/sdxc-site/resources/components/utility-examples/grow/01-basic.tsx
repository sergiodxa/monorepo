/**
 * The opening `grow` example: a flexible item between two fixed ones, taking every bit
 * of room the row has left over.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, gap, grow } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** One item grows to fill the row while its neighbours keep their size. */
export default {
	title: "Basic example",
	description: "Use `grow()` to let a flex item grow to fill any available space:",
	align: "stretch",
	render: () => (
		<div mix={[flex(), gap(4), is("full")]}>
			<div mix={[is(14), demo.block()]}>01</div>
			<div mix={[grow(), demo.block()]}>grow()</div>
			<div mix={[is(14), demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
