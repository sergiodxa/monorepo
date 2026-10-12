/**
 * The opening `maxHeight` example: a panel of text capped in height, which scrolls the
 * overflow instead of growing past the cap.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { overflowY } from "@sdxc/u/overflow";
import { is, maxHeight } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A height cap with the overflow scrolling. */
export default {
	title: "Basic example",
	description:
		'Use `maxHeight(n)` to cap an element\'s height, and pair it with `overflowY("auto")` to scroll whatever does not fit:',
	render: () => (
		<div mix={[maxHeight(32), is(72), overflowY("auto"), demo.panel()]}>
			<p mix={[demo.prose()]}>
				Margins, padding and sizes in this package follow the writing mode, so a layout written once
				reads correctly in every language. A card padded on its inline start keeps that padding
				where a sentence begins, whichever side of the screen that is, and the same holds for a
				list, a sidebar or a toolbar.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
