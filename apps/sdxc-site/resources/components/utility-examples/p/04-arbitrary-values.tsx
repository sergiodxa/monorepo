/**
 * A `p` example with CSS lengths written as strings, for padding the spacing scale has
 * no step for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Padding from any CSS length. */
export default {
	title: "Arbitrary values",
	description:
		'Pass a string to use any CSS length instead of a step of the scale, like `p("1.25rem")` or `p("2em", "5%")`:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[p("1.25rem"), demo.stripes()]}>
				<div mix={[demo.block()]}>p("1.25rem")</div>
			</div>
			<div mix={[p("2em", "5%"), demo.stripes()]}>
				<div mix={[demo.block()]}>p("2em", "5%")</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
