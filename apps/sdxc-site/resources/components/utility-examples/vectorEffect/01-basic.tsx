/**
 * The opening `vectorEffect` example: one chart line drawn in a small viewBox stretched
 * to a wide box, with and without a non-scaling stroke.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fill, stroke, strokeWidth, vectorEffect } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A stretched chart line with a scaled stroke and with a non-scaling one. */
export default {
	title: "Basic example",
	description:
		"Use `vectorEffect` with `non-scaling-stroke` to keep a stroke's width constant when the SVG around it is scaled or stretched:",
	align: "stretch",
	render: () => (
		<div mix={[demo.stack()]}>
			<svg
				width="100%"
				height={80}
				viewBox="0 0 10 10"
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				<polyline
					points="0,8 2,5 4,6 6,2 8,4 10,1"
					mix={[stroke("brand"), fill("none"), strokeWidth(0.5)]}
				/>
			</svg>
			<svg
				width="100%"
				height={80}
				viewBox="0 0 10 10"
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				<polyline
					points="0,8 2,5 4,6 6,2 8,4 10,1"
					mix={[stroke("brand"), fill("none"), strokeWidth(2), vectorEffect("non-scaling-stroke")]}
				/>
			</svg>
		</div>
	),
} satisfies UtilityExampleModule;
