/**
 * The opening `stroke` example: one outlined icon stroked in three tones, so a reader
 * sees a bare tone resolve to its text weight.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fill, stroke, strokeWidth } from "@sdxc/u/color";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** An outlined star stroked in three tones. */
export default {
	title: "Basic example",
	description: "Use `stroke` with a tone to color the outline of an SVG shape:",
	render: () => (
		<div mix={[demo.row()]}>
			<svg
				mix={[stroke("brand"), fill("none"), strokeWidth(1.5)]}
				viewBox="0 0 24 24"
				width={48}
				height={48}
				aria-hidden="true"
			>
				<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z" />
			</svg>
			<svg
				mix={[stroke("success"), fill("none"), strokeWidth(1.5)]}
				viewBox="0 0 24 24"
				width={48}
				height={48}
				aria-hidden="true"
			>
				<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z" />
			</svg>
			<svg
				mix={[stroke("danger"), fill("none"), strokeWidth(1.5)]}
				viewBox="0 0 24 24"
				width={48}
				height={48}
				aria-hidden="true"
			>
				<path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8z" />
			</svg>
		</div>
	),
} satisfies UtilityExampleModule;
