/**
 * The opening `mask` example: a photograph faded out toward its bottom edge by a
 * gradient mask, so the reader sees the mask's transparent end hide the image.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mask } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A photograph faded out by a linear gradient mask. */
export default {
	title: "Basic example",
	description:
		"Use `mask(image)` with a gradient or an image to hide an element where the mask is transparent:",
	render: () => (
		<img
			mix={[mask("linear-gradient(to bottom, black 40%, transparent)"), demo.thumb()]}
			src={demo.photoUrl()}
			alt=""
		/>
	),
} satisfies UtilityExampleModule;
