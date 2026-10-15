/**
 * The only `flex` example: three boxes laid out in a row by a flex container, the
 * starting point every other flex utility builds on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, gap } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Three boxes laid out in a row by a flex container. */
export default {
	title: "Basic example",
	description:
		"Use `flex()` to make an element a flex container, laying its children out in a row:",
	render: () => (
		<div mix={[flex(), gap(4)]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
