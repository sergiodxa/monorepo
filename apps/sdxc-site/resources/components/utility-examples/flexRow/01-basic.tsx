/**
 * The opening `flexRow` example: flex items laid out horizontally in the writing
 * direction, the default a flex container starts with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, flexRow, gap } from "sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Flex items laid out horizontally. */
export default {
	title: "Basic example",
	description:
		"Use `flexRow()` with `flex()` to lay flex items out horizontally, in the same direction as text:",
	render: () => (
		<div mix={[flex(), flexRow(), gap(4)]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
