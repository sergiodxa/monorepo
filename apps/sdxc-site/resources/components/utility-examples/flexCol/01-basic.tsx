/**
 * The only `flexCol` example: a flex container whose children stack from top to bottom,
 * stretched to its width.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, flexCol, gap } from "sdxc/u/layout";
import { is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Flex items stacked vertically. */
export default {
	title: "Basic example",
	description: "Use `flexCol()` with `flex()` to stack flex items vertically:",
	render: () => (
		<div mix={[flex(), flexCol(), gap(4), is(64)]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
