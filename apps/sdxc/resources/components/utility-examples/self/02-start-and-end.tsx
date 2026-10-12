/**
 * A `self` example with `"start"` and `"end"`, two items breaking from a stretched row to
 * hold the top and the bottom of it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, gap, items, self } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Items aligned to either edge of the cross axis on their own. */
export default {
	title: "Start and end",
	description:
		'Use `self("start")` or `self("end")` to align one item to the start or the end of the cross axis:',
	render: () => (
		<div mix={[flex(), gap(4), items("stretch"), is(96), bs(36), demo.stripes()]}>
			<div mix={[self("start"), demo.block()]}>self("start")</div>
			<div mix={[demo.block()]}>02</div>
			<div mix={[self("end"), demo.block()]}>self("end")</div>
		</div>
	),
} satisfies UtilityExampleModule;
