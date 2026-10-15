/**
 * The opening `overflowY` example: a paragraph taller than its box, which scrolls
 * vertically, so a reader sees overflow set along the vertical axis alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { overflowY } from "sdxc/u/overflow";
import { bs, is, maxIs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A box that scrolls vertically when its text does not fit. */
export default {
	title: "Basic example",
	description:
		'Use `overflowY("auto")` to let an element scroll vertically when its content is taller than it is. Scroll the box:',
	render: () => (
		<div mix={[overflowY("auto"), bs(24), is(72), maxIs("100%"), demo.panel()]}>
			<p mix={[demo.prose()]}>
				This paragraph is taller than its box, so the last lines of it do not fit. Scroll to read
				the rest, while the page around the box stays exactly where it is.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
