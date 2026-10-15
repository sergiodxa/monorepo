/**
 * A `filterOpacity` example stacked with other filters, the case it exists for: one
 * filter pass fades and greys an inactive item together.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { blur, filterOpacity, grayscale } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A fade combined with grayscale and blur in one composite filter. */
export default {
	title: "Combining with other filters",
	description:
		'Because it\'s part of the same `filter`, it stacks with `grayscale()`, `blur()` and the rest; a percentage string like `filterOpacity("40%")` works too:',
	render: () => (
		<img
			mix={[filterOpacity("40%"), grayscale(), blur("sm"), demo.thumb()]}
			src={demo.photoUrl()}
			alt=""
		/>
	),
} satisfies UtilityExampleModule;
