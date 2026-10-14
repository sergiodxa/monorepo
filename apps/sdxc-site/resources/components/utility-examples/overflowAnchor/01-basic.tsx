/**
 * The opening `overflowAnchor` example: a feed whose loading sentinel opts out of
 * scroll anchoring, so content appended above it never pins the reader to the sentinel.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { shrink, vstack } from "@sdxc/u/layout";
import { overflowAnchor, scroll } from "@sdxc/u/overflow";
import { bs, is, maxIs } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A sentinel the browser never picks as its scroll anchor. */
export default {
	title: "Basic example",
	description:
		"Use `overflowAnchor()`, which applies `none`, on an infinite-scroll sentinel so the browser never anchors the scroll position to it as new items load above it:",
	render: () => (
		<div mix={[scroll("y"), vstack({ gap: 3 }), bs(48), is(72), maxIs("100%"), demo.panel()]}>
			<div mix={[shrink(), demo.block()]}>Post 1</div>
			<div mix={[shrink(), demo.block()]}>Post 2</div>
			<div mix={[shrink(), demo.block()]}>Post 3</div>
			<div mix={[shrink(), demo.block()]}>Post 4</div>
			<p mix={[overflowAnchor(), demo.caption()]}>Loading more…</p>
		</div>
	),
} satisfies UtilityExampleModule;
