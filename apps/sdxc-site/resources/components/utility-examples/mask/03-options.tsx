/**
 * A `mask` example with the options object, which sets the mask's size and repeat beside
 * its image, here tiling small dots into a halftone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mask } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A tiled mask set through its size and repeat options. */
export default {
	title: "Setting size and repeat",
	description:
		"Pass an object to set the mask's `image`, `size`, `position`, `repeat` and `mode` together:",
	render: () => (
		<img
			mix={[
				mask({
					image: "radial-gradient(circle, black 45%, transparent 50%)",
					size: "0.75rem 0.75rem",
					repeat: "repeat",
				}),
				demo.thumb(),
			]}
			src={demo.photoUrl()}
			alt=""
		/>
	),
} satisfies UtilityExampleModule;
