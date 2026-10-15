/**
 * The opening `calc` example: a box sized from the width of its container minus a fixed
 * amount, with the space the subtraction leaves drawn as stripes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { calc } from "sdxc/u/general";
import { is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A width mixing a percentage and a length in one expression. */
export default {
	title: "Basic example",
	description:
		'Use `calc(expression)` to compute a CSS value that mixes units, then pass it to any utility that takes a length, like `is(calc("100% - 8rem"))`:',
	align: "stretch",
	render: () => (
		<div mix={[demo.track()]}>
			<div mix={[is(calc("100% - 8rem")), demo.block()]}>is(calc("100% - 8rem"))</div>
		</div>
	),
} satisfies UtilityExampleModule;
