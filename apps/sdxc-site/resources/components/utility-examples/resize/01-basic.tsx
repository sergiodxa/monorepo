/**
 * The opening `resize` example: a textarea a reader can drag taller but not wider, the
 * shape most comment boxes want.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { resize } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The default resizes along the block axis only. */
export default {
	title: "Basic example",
	description:
		"Use `resize()` to let a reader resize an element along the block axis only. Drag the textarea's corner to try it:",
	render: () => (
		<textarea placeholder="Leave a comment" mix={[resize(), is(80), bs(24), demo.field()]} />
	),
} satisfies UtilityExampleModule;
