/**
 * The opening `basis` example: three flex items whose starting sizes come from steps of
 * the spacing scale, so one item starts twice as wide as the others.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { basis, flex, gap } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Flex items sized from the spacing scale before they grow or shrink. */
export default {
	title: "Basic example",
	description:
		"Use `basis(n)` with a step of the spacing scale, like `basis(32)` or `basis(64)`, to set the size a flex item starts from:",
	render: () => (
		<div mix={[flex(), gap(4)]}>
			<div mix={[basis(32), demo.block()]}>basis(32)</div>
			<div mix={[basis(32), demo.block()]}>basis(32)</div>
			<div mix={[basis(64), demo.block()]}>basis(64)</div>
		</div>
	),
} satisfies UtilityExampleModule;
