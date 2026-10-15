/**
 * The `inlineBlock` example: padded boxes sitting in a run of text, which keep their
 * padding and stay whole rather than wrapping like words.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { inlineBlock } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An inline block sits in the line yet keeps its own box, padding and all. */
export default {
	title: "Basic example",
	description:
		"Use `inlineBlock()` to keep an element in the line of text while it keeps its own box, so padding and size apply and it never splits across lines:",
	render: () => (
		<div mix={[is(96), demo.prose()]}>
			Press <div mix={[inlineBlock(), demo.block()]}>inlineBlock()</div> to keep a box whole inside
			a sentence, then <div mix={[inlineBlock(), demo.block()]}>save</div> when you are done.
		</div>
	),
} satisfies UtilityExampleModule;
