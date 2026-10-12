/**
 * The opening `absolute` example: a box lifted out of the flow and pinned to the top
 * right corner of its relative parent, whose stripes stay empty where the box used to sit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { absolute, insRight, insTop, relative } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An absolutely positioned box placed by insets against a relative parent. */
export default {
	title: "Basic example",
	description:
		"Use `absolute()` to position an element against its nearest positioned ancestor, then place it with inset utilities like `insTop(0)` and `insRight(0)`:",
	render: () => (
		<div mix={[relative(), is(72), bs(32), demo.track()]}>
			<div mix={[absolute(), insTop(0), insRight(0), demo.block()]}>absolute()</div>
		</div>
	),
} satisfies UtilityExampleModule;
