/**
 * A `justify` example with `"around"` and `"evenly"`, which differ only in how much room
 * they leave at the two ends of the row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flex, justify } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Space around halves the room at the ends; space evenly matches it. */
export default {
	title: "Space around and evenly",
	description:
		'Use `justify("around")` to give each item equal room on both sides, or `justify("evenly")` to make every gap the same, the ends included:',
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<div mix={[flex(), justify("around"), demo.stripes()]}>
				<div mix={[demo.block()]}>around</div>
				<div mix={[demo.block()]}>02</div>
				<div mix={[demo.block()]}>03</div>
			</div>
			<div mix={[flex(), justify("evenly"), demo.stripes()]}>
				<div mix={[demo.block()]}>evenly</div>
				<div mix={[demo.block()]}>02</div>
				<div mix={[demo.block()]}>03</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
