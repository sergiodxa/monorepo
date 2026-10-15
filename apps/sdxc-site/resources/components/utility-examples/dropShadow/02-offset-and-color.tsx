/**
 * A `dropShadow` example with every option set: a hard offset shadow and a colored glow,
 * so the reader sees `x`, `y`, `blur` and `color` each change the result.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dropShadow } from "@sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A hard offset shadow and a tinted glow. */
export default {
	title: "Setting the offset and color",
	description:
		"Pass `x`, `y`, `blur` and a theme `color` to shape the shadow, from a hard offset to a soft glow:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<svg
					viewBox="0 0 24 24"
					mix={[dropShadow({ x: 1, y: 1, blur: 0, color: "neutral.strong" }), demo.icon()]}
				>
					<path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7z" />
				</svg>
				<span mix={[demo.caption()]}>hard offset</span>
			</div>
			<div mix={[demo.figure()]}>
				<svg
					viewBox="0 0 24 24"
					mix={[dropShadow({ y: 0, blur: 3, color: "brand.solid" }), demo.icon()]}
				>
					<path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7z" />
				</svg>
				<span mix={[demo.caption()]}>glow</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
