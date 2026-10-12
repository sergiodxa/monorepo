/**
 * A `justify` example with `"start"`, `"center"` and `"end"`, the same items packed
 * against each position of the main axis.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, gap, justify } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Items packed at the start, in the center and at the end of the row. */
export default {
	title: "Start, center and end",
	description:
		'Use `justify("start")`, `justify("center")` or `justify("end")` to pack items against that part of the main axis:',
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[flex(), gap(4), justify("start"), demo.stripes()]}>
				<div mix={[demo.block()]}>start</div>
				<div mix={[demo.block()]}>02</div>
			</div>
			<div mix={[flex(), gap(4), justify("center"), demo.stripes()]}>
				<div mix={[demo.block()]}>center</div>
				<div mix={[demo.block()]}>02</div>
			</div>
			<div mix={[flex(), gap(4), justify("end"), demo.stripes()]}>
				<div mix={[demo.block()]}>end</div>
				<div mix={[demo.block()]}>02</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
