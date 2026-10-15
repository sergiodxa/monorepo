/**
 * A `mask` example with a radial gradient, for a vignette that keeps the centre of a
 * photograph and fades its edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mask } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A soft vignette from a radial gradient mask. */
export default {
	title: "Using a radial gradient",
	description:
		"Any CSS image works as a mask, like a `radial-gradient()` that fades an image out from its centre:",
	render: () => (
		<img
			mix={[mask("radial-gradient(closest-side, black 50%, transparent)"), demo.thumb()]}
			src={demo.photoUrl()}
			alt=""
		/>
	),
} satisfies UtilityExampleModule;
