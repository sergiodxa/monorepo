/**
 * The opening `strokeLinecap` example: three thick lines with each cap, over a guide
 * that marks where every line's path really ends.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { stroke, strokeLinecap, strokeWidth } from "sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** Butt, round and square caps on thick lines. */
export default {
	title: "Basic example",
	description:
		"Use `strokeLinecap` to set how the open ends of a line are drawn: `butt` stops at the end, `round` and `square` extend past it:",
	render: () => (
		<svg width={240} height={120} viewBox="0 0 240 120" aria-hidden="true">
			<line
				x1={40}
				y1={24}
				x2={200}
				y2={24}
				mix={[stroke("brand"), strokeWidth(16), strokeLinecap("butt")]}
			/>
			<line
				x1={40}
				y1={60}
				x2={200}
				y2={60}
				mix={[stroke("brand"), strokeWidth(16), strokeLinecap("round")]}
			/>
			<line
				x1={40}
				y1={96}
				x2={200}
				y2={96}
				mix={[stroke("brand"), strokeWidth(16), strokeLinecap("square")]}
			/>
			<path d="M40 8V112M200 8V112" mix={[stroke("danger"), strokeWidth(1)]} />
		</svg>
	),
} satisfies UtilityExampleModule;
