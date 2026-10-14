/**
 * A `resize` example with `"none"`: a textarea that keeps the size the layout gave it,
 * with no handle for a reader to drag.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { resize } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** No axis resizes, so the handle is gone. */
export default {
	title: "Preventing resizing",
	description:
		'Use `resize("none")` to keep an element at the size the layout gives it, removing a textarea\'s handle:',
	render: () => (
		<textarea placeholder="Fixed size" mix={[resize("none"), is(80), bs(24), demo.field()]} />
	),
} satisfies UtilityExampleModule;
