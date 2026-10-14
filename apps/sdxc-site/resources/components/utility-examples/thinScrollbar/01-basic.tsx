/**
 * The opening `thinScrollbar` example: a thin scrollbar beside the platform's default
 * one, so a reader compares the two widths on the same content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scroll, thinScrollbar } from "@sdxc/u/overflow";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A thin scrollbar against the default one. */
export default {
	title: "Basic example",
	description:
		'Use `thinScrollbar()` with `scroll("y")` to ask for a thin scrollbar whose gutter is reserved up front. Compare it with the default one beside it:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[scroll("y"), thinScrollbar(), bs(32), is(56), demo.panel()]}>
				<p mix={[demo.prose()]}>
					This paragraph is taller than its box, so the last lines of it do not fit. Scroll to read
					the rest, while the page around the box stays exactly where it is.
				</p>
			</div>
			<div mix={[scroll("y"), bs(32), is(56), demo.panel()]}>
				<p mix={[demo.prose()]}>
					This paragraph is taller than its box, so the last lines of it do not fit. Scroll to read
					the rest, while the page around the box stays exactly where it is.
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
