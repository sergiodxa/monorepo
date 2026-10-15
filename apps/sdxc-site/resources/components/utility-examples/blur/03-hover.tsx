/**
 * A `blur` example that clears on hover, so a reader sees the blur write a value a state
 * can override and the transition carry it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { blur, transition } from "sdxc/u/effects";
import { hover } from "sdxc/u/state";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A blurred image that sharpens when hovered. */
export default {
	title: "Removing the blur on hover",
	description:
		'Override the blur with `hover(blur("0px"))` to reveal the image when it\'s hovered. Hover the photograph:',
	render: () => (
		<img
			mix={[blur("lg"), hover(blur("0px")), transition("filter", { duration: 300 }), demo.thumb()]}
			src={demo.photoUrl()}
			alt=""
		/>
	),
} satisfies UtilityExampleModule;
