/**
 * An `overflowInline` example with its default `hidden`, so items past the row's inline
 * end are cut off.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, shrink } from "@sdxc/u/layout";
import { overflowInline } from "@sdxc/u/overflow";
import { is, maxIs, p } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A row clipped at its inline end. */
export default {
	title: "Clipping the inline axis",
	description:
		"Call `overflowInline()`, which applies `hidden`, to clip content that overflows along the inline axis:",
	render: () => (
		<div mix={[overflowInline(), hstack({ gap: 4 }), is(96), maxIs("100%"), p(4), demo.track()]}>
			<div mix={[shrink(), is(24), demo.block()]}>1</div>
			<div mix={[shrink(), is(24), demo.block()]}>2</div>
			<div mix={[shrink(), is(24), demo.block()]}>3</div>
			<div mix={[shrink(), is(24), demo.block()]}>4</div>
			<div mix={[shrink(), is(24), demo.block()]}>5</div>
		</div>
	),
} satisfies UtilityExampleModule;
