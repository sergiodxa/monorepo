/**
 * The opening `scrollbarGutter` example: a box whose text fits and one whose text
 * overflows, both reserving the scrollbar's gutter, so their text starts and wraps at
 * the same width.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { scroll, scrollbarGutter } from "@sdxc/u/overflow";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The same content width whether or not a scrollbar shows. */
export default {
	title: "Basic example",
	description:
		"Use `scrollbarGutter()` on a scroll container to reserve room for its scrollbar before one appears, so content does not shift when it overflows. Turn on always-visible scrollbars in your system settings to see the gutter:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[scroll("y"), scrollbarGutter(), bs(32), is(56), demo.panel()]}>
				<p mix={[demo.prose()]}>This short text fits.</p>
			</div>
			<div mix={[scroll("y"), scrollbarGutter(), bs(32), is(56), demo.panel()]}>
				<p mix={[demo.prose()]}>
					This paragraph is taller than its box, so the last lines of it do not fit. Scroll to read
					the rest, while the page around the box stays exactly where it is.
				</p>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
