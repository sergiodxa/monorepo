/**
 * The opening `clip` example: a photo larger than its frame, cut off at the frame's
 * edge, so a reader sees overflow clipped with no scroll position to reach it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { clip } from "@sdxc/u/overflow";
import { bs, is } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An oversized child cut off at its parent's border box. */
export default {
	title: "Basic example",
	description:
		"Use `clip()` to cut off any content that overflows an element, with no way to scroll to it, not even from script:",
	render: () => (
		<div mix={[clip(), is(64), bs(32), demo.track()]}>
			<div mix={[is(96), bs(48), demo.photo()]} />
		</div>
	),
} satisfies UtilityExampleModule;
