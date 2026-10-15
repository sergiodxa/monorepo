/**
 * The opening `scrollTimelineName` example: a reading progress bar that fills as the
 * box scrolls, driven by the timeline the scroll container names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animation, scrollTimelineName } from "sdxc/u/animation";
import { bg } from "sdxc/u/color";
import { insTop, sticky } from "sdxc/u/layout";
import { scroll } from "sdxc/u/overflow";
import { bs } from "sdxc/u/size";
import { transformOrigin } from "sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A progress bar driven by its scroll container's named timeline. */
export default {
	title: "Basic example",
	description:
		'Use `scrollTimelineName()` on a scroll container to name its scroll progress, then animate a descendant on `timeline: "--name"`. Scroll the box to fill the bar:',
	align: "stretch",
	render: () => (
		<div mix={[scrollTimelineName("article"), scroll("y"), bs(48), demo.panel()]}>
			<div
				mix={[
					sticky(),
					insTop(0),
					bs(2),
					bg("brand.solid"),
					transformOrigin("left"),
					animation("progress", {
						keyframes: { from: { scale: "0 1" }, to: { scale: "1 1" } },
						duration: "auto",
						easing: "linear",
						timeline: "--article",
					}),
				]}
			/>
			<div mix={[demo.stack()]}>
				{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
					<p mix={[demo.prose()]}>Paragraph {n}. Scroll this box to drive the timeline.</p>
				))}
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
