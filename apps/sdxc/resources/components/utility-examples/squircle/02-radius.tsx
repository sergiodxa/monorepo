/**
 * A `squircle` example across the radius scale, from the default step to the largest, as
 * an app icon or a card would use them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { aspect, is, squircle } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Squircles from named steps of the radius scale. */
export default {
	title: "Radius",
	description:
		'Pass a step of the radius scale, like `squircle("lg")`, or any CSS length; with no argument it uses `"md"`:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[squircle(), is(20), aspect("square"), demo.fill()]}>md</div>
			<div mix={[squircle("lg"), is(20), aspect("square"), demo.fill()]}>lg</div>
			<div mix={[squircle("xl"), is(20), aspect("square"), demo.fill()]}>xl</div>
			<div mix={[squircle("2rem"), is(20), aspect("square"), demo.fill()]}>2rem</div>
		</div>
	),
} satisfies UtilityExampleModule;
