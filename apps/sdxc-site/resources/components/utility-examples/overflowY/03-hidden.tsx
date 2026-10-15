/**
 * An `overflowY` example with its default `hidden`, so the paragraph is cut off at the
 * bottom of its box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { overflowY } from "sdxc/u/overflow";
import { bs, is, maxIs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A box clipped at its block edge. */
export default {
	title: "Clipping vertically",
	description:
		"Call `overflowY()`, which applies `hidden`, to clip content that is taller than its element:",
	render: () => (
		<div mix={[overflowY(), bs(24), is(72), maxIs("100%"), demo.panel()]}>
			<p mix={[demo.prose()]}>
				This paragraph is taller than its box, so the last lines of it do not fit. Scroll to read
				the rest, while the page around the box stays exactly where it is.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
