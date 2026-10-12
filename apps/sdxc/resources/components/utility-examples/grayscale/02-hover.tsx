/**
 * A `grayscale` example that restores color on hover, the classic logo-wall pattern, so
 * the reader can watch the filter ease back to full color.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { grayscale, transition } from "@sdxc/u/effects";
import { hover } from "@sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A grey image that regains its color when hovered. */
export default {
	title: "Restoring color on hover",
	description:
		"Set `grayscale()` and override it with `hover(grayscale(0))` to bring color back when the element is hovered. Hover the photograph:",
	render: () => (
		<img
			mix={[
				grayscale(),
				hover(grayscale(0)),
				transition("filter", { duration: 300 }),
				demo.thumb(),
			]}
			src={demo.photoUrl()}
			alt=""
		/>
	),
} satisfies UtilityExampleModule;
