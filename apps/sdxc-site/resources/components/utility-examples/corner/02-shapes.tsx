/**
 * A `corner` example with every shape it takes, drawn on the same radius so each shape's
 * cut is the only difference between the boxes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rounded } from "@sdxc/u/effects";
import { aspect, corner, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Every corner shape at one radius. */
export default {
	title: "Corner shapes",
	description: 'Pass `"squircle"`, `"bevel"` or `"notch"` to change the shape the radius draws:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[rounded("2rem"), corner("squircle"), is(32), aspect("square"), demo.fill()]}>
				squircle
			</div>
			<div mix={[rounded("2rem"), corner("bevel"), is(32), aspect("square"), demo.fill()]}>
				bevel
			</div>
			<div mix={[rounded("2rem"), corner("notch"), is(32), aspect("square"), demo.fill()]}>
				notch
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
