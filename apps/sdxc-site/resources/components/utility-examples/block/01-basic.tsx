/**
 * The only `block` example: an inline span made a block inside running text, so it breaks
 * onto its own line and spans the paragraph's whole width.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { block } from "sdxc/u/layout";
import { maxIs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A span inside a paragraph made a block box. */
export default {
	title: "Basic example",
	description:
		"Use `block()` to make an element a block box that starts on its own line and fills the width of its parent:",
	render: () => (
		<p mix={[maxIs(96), demo.prose()]}>
			When an inline span becomes a block,
			<span mix={[block(), demo.box()]}>block()</span>
			it breaks out of the line of text it sat in and stretches across the paragraph.
		</p>
	),
} satisfies UtilityExampleModule;
