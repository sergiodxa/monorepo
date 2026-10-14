/**
 * An `overflow` example with `auto`, so the box becomes scrollable only because its
 * paragraph does not fit, and shows a scrollbar only then.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { overflow } from "@sdxc/u/overflow";
import { bs, is, maxIs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A scrollbar that appears only when content overflows. */
export default {
	title: "Scrolling if needed",
	description:
		'Use `overflow("auto")` to make an element scrollable when its content overflows, with scrollbars shown only when they are needed. Scroll the box:',
	render: () => (
		<div mix={[overflow("auto"), bs(24), is(72), maxIs("100%"), demo.panel()]}>
			<p mix={[demo.prose()]}>
				This paragraph is taller than its box, so the last lines of it do not fit. Scroll to read
				the rest, while the page around the box stays exactly where it is.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
