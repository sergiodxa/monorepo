/**
 * The opening `overflow` example: a paragraph taller than its box, cut off at the box's
 * edge, so a reader sees the default `hidden` value clip what does not fit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { overflow } from "sdxc/u/overflow";
import { bs, is, maxIs } from "sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Content past the box's edge, clipped by the default value. */
export default {
	title: "Basic example",
	description:
		"Use `overflow()`, which applies `hidden`, to clip any content that overflows the bounds of an element:",
	render: () => (
		<div mix={[overflow(), bs(24), is(72), maxIs("100%"), demo.panel()]}>
			<p mix={[demo.prose()]}>
				This paragraph is taller than its box, so the last lines of it do not fit. Scroll to read
				the rest, while the page around the box stays exactly where it is.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
