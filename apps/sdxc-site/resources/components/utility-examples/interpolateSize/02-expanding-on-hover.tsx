/**
 * An `interpolateSize` example on the inline axis: a compact button that widens to its
 * full label on hover, animating to `max-content`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { transition } from "sdxc/u/effects";
import { interpolateSize } from "sdxc/u/layout";
import { overflow } from "sdxc/u/overflow";
import { is } from "sdxc/u/size";
import { hover } from "sdxc/u/state";
import { nowrap } from "sdxc/u/typography";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A width transition to max-content reveals a label on hover. */
export default {
	title: "Animating to a content size",
	description:
		"Keyword sizes work on either axis, so a width can animate to `max-content`. Hover the button to reveal its label:",
	render: () => (
		<button
			type="button"
			mix={[
				interpolateSize(),
				is(10),
				hover(is("max-content")),
				overflow("hidden"),
				nowrap(),
				transition("inline-size", { duration: 250 }),
				demo.button(),
			]}
		>
			＋ New post
		</button>
	),
} satisfies UtilityExampleModule;
