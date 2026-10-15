/**
 * An `overflowBlock` example with its default `hidden`, so the paragraph is cut off at
 * the box's block end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { overflowBlock } from "sdxc/u/overflow";
import { bs, is, maxIs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A box clipped at its block end. */
export default {
	title: "Clipping the block axis",
	description:
		"Call `overflowBlock()`, which applies `hidden`, to clip content that overflows along the block axis:",
	render: () => (
		<div mix={[overflowBlock(), bs(24), is(72), maxIs("100%"), demo.panel()]}>
			<p mix={[demo.prose()]}>
				This paragraph is taller than its box, so the last lines of it do not fit. Scroll to read
				the rest, while the page around the box stays exactly where it is.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
