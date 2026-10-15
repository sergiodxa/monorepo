/**
 * The opening `timelineScope` example: a progress bar outside the scroll box it
 * tracks, reaching the box's named timeline through the scope on their common parent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { animation, scrollTimelineName, timelineScope } from "@sdxc/u/animation";
import { bg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { scroll } from "@sdxc/u/overflow";
import { bs } from "@sdxc/u/size";
import { transformOrigin } from "@sdxc/u/transform";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A progress bar outside the scroller, reaching its timeline through a shared scope. */
export default {
	title: "Basic example",
	description:
		"Use `timelineScope()` on a common parent to let elements outside the scroll container use its named timeline. Scroll the box to fill the bar above it:",
	align: "stretch",
	render: () => (
		<div mix={[timelineScope("article"), vstack({ gap: 3, align: "stretch" })]}>
			<div
				mix={[
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
			<div mix={[scrollTimelineName("article"), scroll("y"), bs(40), demo.panel()]}>
				<div mix={[demo.stack()]}>
					{[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
						<p mix={[demo.prose()]}>Paragraph {n}. Scroll this box to drive the timeline.</p>
					))}
				</div>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
