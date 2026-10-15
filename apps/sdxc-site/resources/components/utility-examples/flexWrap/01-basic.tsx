/**
 * The opening `flexWrap` example: more items than fit on one line, wrapping onto a new
 * line instead of overflowing the container.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, flexWrap, gap } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Flex items wrapping onto new lines when they run out of room. */
export default {
	title: "Basic example",
	description: "Use `flexWrap()` to let flex items wrap onto a new line when they run out of room:",
	render: () => (
		<div mix={[flex(), flexWrap(), gap(4), is(96), demo.track()]}>
			<div mix={[is(28), demo.block()]}>01</div>
			<div mix={[is(28), demo.block()]}>02</div>
			<div mix={[is(28), demo.block()]}>03</div>
			<div mix={[is(28), demo.block()]}>04</div>
			<div mix={[is(28), demo.block()]}>05</div>
		</div>
	),
} satisfies UtilityExampleModule;
