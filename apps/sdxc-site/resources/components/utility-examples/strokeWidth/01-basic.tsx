/**
 * The opening `strokeWidth` example: one line drawn at growing widths, where a bare
 * number is read in the SVG's own units.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { stroke, strokeWidth } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

/** Lines one, two, four and eight units wide. */
export default {
	title: "Basic example",
	description:
		"Use `strokeWidth` with a number to set the width of an SVG shape's stroke, in the SVG's own units:",
	render: () => (
		<svg width={240} height={96} viewBox="0 0 240 96" aria-hidden="true">
			<line x1={8} y1={12} x2={232} y2={12} mix={[stroke("brand"), strokeWidth(1)]} />
			<line x1={8} y1={36} x2={232} y2={36} mix={[stroke("brand"), strokeWidth(2)]} />
			<line x1={8} y1={60} x2={232} y2={60} mix={[stroke("brand"), strokeWidth(4)]} />
			<line x1={8} y1={86} x2={232} y2={86} mix={[stroke("brand"), strokeWidth(8)]} />
		</svg>
	),
} satisfies UtilityExampleModule;
