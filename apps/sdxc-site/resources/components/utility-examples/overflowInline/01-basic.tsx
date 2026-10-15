/**
 * The opening `overflowInline` example: a row wider than its track that scrolls along
 * the inline axis, the logical counterpart of a horizontal scroll.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink } from "sdxc/u/layout";
import { overflowInline } from "sdxc/u/overflow";
import { is, maxIs, p } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A row that scrolls along the inline axis. */
export default {
	title: "Basic example",
	description:
		'Use `overflowInline("auto")` to let an element scroll along the inline axis, horizontally in a left-to-right page, when its content does not fit. Scroll the row sideways:',
	render: () => (
		<div
			mix={[overflowInline("auto"), hstack({ gap: 4 }), is(96), maxIs("100%"), p(4), demo.track()]}
		>
			<div mix={[shrink(), is(24), demo.block()]}>1</div>
			<div mix={[shrink(), is(24), demo.block()]}>2</div>
			<div mix={[shrink(), is(24), demo.block()]}>3</div>
			<div mix={[shrink(), is(24), demo.block()]}>4</div>
			<div mix={[shrink(), is(24), demo.block()]}>5</div>
		</div>
	),
} satisfies UtilityExampleModule;
