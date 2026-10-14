/**
 * The only `flexRowReverse` example: three boxes laid out from the end of the row, so the
 * first in the markup sits furthest along.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flexRowReverse, gap } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Flex items laid out horizontally in reverse order. */
export default {
	title: "Basic example",
	description:
		"Use `flexRowReverse()` to lay flex items out horizontally in the opposite order; it makes the element a flex container too:",
	render: () => (
		<div mix={[flexRowReverse(), gap(4)]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
