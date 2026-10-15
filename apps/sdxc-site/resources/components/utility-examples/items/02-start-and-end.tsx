/**
 * An `items` example with `"start"` and `"end"`, the same items held to the top and
 * then to the bottom of their row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, gap, items } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Start and end align items to either edge of the cross axis. */
export default {
	title: "Start and end",
	description:
		'Use `items("start")` or `items("end")` to align items to the start or the end of the cross axis:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[flex(), gap(4), items("start"), is(64), bs(36), demo.stripes()]}>
				<div mix={[bs(12), demo.block()]}>01</div>
				<div mix={[bs(24), demo.block()]}>02</div>
				<div mix={[bs(16), demo.block()]}>03</div>
			</div>
			<div mix={[flex(), gap(4), items("end"), is(64), bs(36), demo.stripes()]}>
				<div mix={[bs(12), demo.block()]}>01</div>
				<div mix={[bs(24), demo.block()]}>02</div>
				<div mix={[bs(16), demo.block()]}>03</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
