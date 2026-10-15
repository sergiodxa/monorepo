/**
 * The opening `corner` example: one radius drawn as a plain round corner and as a
 * squircle, so the smoother curve shows against the plain one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { rounded } from "sdxc/u/effects";
import { aspect, corner, is } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A squircle corner against a plain round one at the same radius. */
export default {
	title: "Basic example",
	description:
		'Use `corner("squircle")` with a radius to draw smooth, continuous corners. Browsers without `corner-shape` keep the plain rounded corner:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[rounded("3rem"), is(36), aspect("square"), demo.fill()]}>rounded</div>
			<div mix={[rounded("3rem"), corner("squircle"), is(36), aspect("square"), demo.fill()]}>
				squircle
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
