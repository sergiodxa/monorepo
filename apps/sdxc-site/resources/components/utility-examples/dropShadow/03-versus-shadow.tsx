/**
 * A `dropShadow` example beside `shadow()` on the same icon, so the reader sees which
 * one traces the drawing and which one shadows the element's box.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dropShadow, shadow } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** The same icon under a box shadow and under a drop shadow. */
export default {
	title: "Compared to a box shadow",
	description:
		"`shadow()` shadows the element's rectangular box, while `dropShadow()` follows what is actually drawn:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<svg viewBox="0 0 24 24" mix={[shadow("lg"), demo.icon()]}>
					<path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7z" />
				</svg>
				<span mix={[demo.caption()]}>shadow("lg")</span>
			</div>
			<div mix={[demo.figure()]}>
				<svg viewBox="0 0 24 24" mix={[dropShadow({ y: 2, blur: 3 }), demo.icon()]}>
					<path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7z" />
				</svg>
				<span mix={[demo.caption()]}>dropShadow()</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
