/**
 * A `borderEdge` example of a stepper, whose buttons and value share one frame and are
 * split by dividers on the value's two inline edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { border, borderEdge } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { inlineFlex } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A value divided from the buttons around it along its two inline edges. */
export default {
	title: "Dividers between items",
	description:
		"Draw a border on the edges an item shares with its neighbours to divide items that sit in one frame:",
	render: () => (
		<div
			mix={[
				inlineFlex(),
				border({ color: "neutral.strong", width: 1 }),
				rounded("md"),
				overflow("hidden"),
			]}
		>
			<button type="button" mix={[border("none"), demo.swatch()]}>
				−
			</button>
			<span
				mix={[
					borderEdge("inline-start", { color: "neutral.strong", width: 1 }),
					borderEdge("inline-end", { color: "neutral.strong", width: 1 }),
					demo.swatch(),
				]}
			>
				12
			</span>
			<button type="button" mix={[border("none"), demo.swatch()]}>
				+
			</button>
		</div>
	),
} satisfies UtilityExampleModule;
