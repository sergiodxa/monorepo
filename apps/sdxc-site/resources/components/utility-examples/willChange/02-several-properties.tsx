/**
 * A `willChange` example hinting two properties at once, for a photo that both fades and
 * scales as the pointer moves over it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { opacity, transition } from "@sdxc/u/effects";
import { willChange } from "@sdxc/u/general";
import { bs, is } from "@sdxc/u/size";
import { hover } from "@sdxc/u/state";
import { scale } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A photo hinted for an opacity and a transform change. */
export default {
	title: "Several properties",
	description:
		'List several properties separated by commas, like `willChange("opacity, transform")`, when an animation changes more than one. Hover the photo:',
	render: () => (
		<div
			mix={[
				willChange("opacity, transform"),
				transition("opacity, transform"),
				hover([opacity(80), scale(1.05)]),
				is(64),
				bs(40),
				demo.photo(),
			]}
		/>
	),
} satisfies UtilityExampleModule;
