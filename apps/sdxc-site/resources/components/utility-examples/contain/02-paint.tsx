/**
 * A `contain` example comparing `"none"` with `"paint"`: the same child pokes out of
 * both boxes, and paint containment clips it to the box's edge.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, contain, insRight, insTop, relative } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Overflowing children drawn in full without containment and clipped with paint containment. */
export default {
	title: "Clipping with paint containment",
	description:
		'Use `contain("paint")` to clip everything an element\'s descendants draw to its own box:',
	render: () => (
		<div mix={[demo.gallery()]}>
			<div mix={[relative(), contain("none"), is(40), bs(24), demo.track()]}>
				<div mix={[absolute(), insTop(-4), insRight(-4), demo.block()]}>none</div>
			</div>
			<div mix={[relative(), contain("paint"), is(40), bs(24), demo.track()]}>
				<div mix={[absolute(), insTop(-4), insRight(-4), demo.block()]}>paint</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
