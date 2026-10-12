/**
 * The opening `flexColReverse` example: three boxes stacked from the bottom up, so the
 * first in the markup ends up last on screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flexColReverse, gap } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Flex items stacked vertically in reverse order. */
export default {
	title: "Basic example",
	description:
		"Use `flexColReverse()` to stack flex items vertically in the opposite order; it makes the element a flex container too:",
	render: () => (
		<div mix={[flexColReverse(), gap(4), is(64)]}>
			<div mix={[demo.block()]}>01</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[demo.block()]}>03</div>
		</div>
	),
} satisfies UtilityExampleModule;
