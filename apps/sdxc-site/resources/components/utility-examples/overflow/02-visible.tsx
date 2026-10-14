/**
 * An `overflow` example with `visible`, so the paragraph spills past the bottom of its
 * box and a reader sees the platform's default left alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { overflow } from "@sdxc/u/overflow";
import { bs, is, maxIs, mbe } from "@sdxc/u/size";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Content drawn past the box's edge. */
export default {
	title: "Showing content that overflows",
	description:
		'Use `overflow("visible")` to let content that does not fit draw past the edge of its element:',
	render: () => (
		<div mix={[overflow("visible"), bs(16), is(72), maxIs("100%"), mbe(20), demo.panel()]}>
			<p mix={[demo.prose()]}>
				This paragraph is taller than its box, so the last lines of it do not fit. Scroll to read
				the rest, while the page around the box stays exactly where it is.
			</p>
		</div>
	),
} satisfies UtilityExampleModule;
