/**
 * The opening `overflowBlock` example: a paragraph longer than its box that scrolls
 * along the block axis, the logical counterpart of a vertical scroll.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { overflowBlock } from "@sdxc/u/overflow";
import { bs, is, maxIs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A box that scrolls along the block axis. */
export default {
	title: "Basic example",
	description:
		'Use `overflowBlock("auto")` to let an element scroll along the block axis, vertically in a horizontal writing mode, when its content does not fit. Scroll the box:',
	render: () => (
		<div mix={[overflowBlock("auto"), bs(24), is(72), maxIs("100%"), demo.panel()]}>
			<p mix={[demo.prose()]}>
				This paragraph is taller than its box, so the last lines of it do not fit. Scroll to read
				the rest, while the page around the box stays exactly where it is.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
