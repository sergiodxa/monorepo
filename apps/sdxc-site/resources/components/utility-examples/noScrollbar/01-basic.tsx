/**
 * The opening `noScrollbar` example: a row of chips that still scrolls by wheel, touch
 * and keyboard, with its scrollbar hidden, beside the same row with its scrollbar
 * showing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink } from "@sdxc/u/layout";
import { noScrollbar, scroll } from "@sdxc/u/overflow";
import { is, maxIs, p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A scrollable row with no visible scrollbar. */
export default {
	title: "Basic example",
	description:
		'Use `noScrollbar()` with `scroll("x")` to keep a row scrollable while hiding its scrollbar, as in a strip of filter chips. Scroll the row sideways with a trackpad or touch:',
	render: () => (
		<div
			mix={[
				scroll("x"),
				noScrollbar(),
				hstack({ gap: 4 }),
				is(96),
				maxIs("100%"),
				p(4),
				demo.track(),
			]}
		>
			<div mix={[shrink(), is(24), demo.block()]}>1</div>
			<div mix={[shrink(), is(24), demo.block()]}>2</div>
			<div mix={[shrink(), is(24), demo.block()]}>3</div>
			<div mix={[shrink(), is(24), demo.block()]}>4</div>
			<div mix={[shrink(), is(24), demo.block()]}>5</div>
			<div mix={[shrink(), is(24), demo.block()]}>6</div>
			<div mix={[shrink(), is(24), demo.block()]}>7</div>
			<div mix={[shrink(), is(24), demo.block()]}>8</div>
		</div>
	),
} satisfies UtilityExampleModule;
