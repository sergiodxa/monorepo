/**
 * The opening `dropShadow` example: an icon shadowed at its default and at two larger
 * offsets, so the reader sees the shadow trace the drawing's points.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { dropShadow } from "sdxc/u/effects";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Drop shadows that follow an icon's outline. */
export default {
	title: "Basic example",
	description:
		"Use `dropShadow()` to shadow the shape an element draws — an SVG icon or a transparent image — and pass `y` and `blur` to make it deeper:",
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<svg viewBox="0 0 24 24" mix={[dropShadow(), demo.icon()]}>
					<path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7z" />
				</svg>
				<span mix={[demo.caption()]}>default</span>
			</div>
			<div mix={[demo.figure()]}>
				<svg viewBox="0 0 24 24" mix={[dropShadow({ y: 2, blur: 3 }), demo.icon()]}>
					<path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7z" />
				</svg>
				<span mix={[demo.caption()]}>y: 2, blur: 3</span>
			</div>
			<div mix={[demo.figure()]}>
				<svg viewBox="0 0 24 24" mix={[dropShadow({ y: 4, blur: 6 }), demo.icon()]}>
					<path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7z" />
				</svg>
				<span mix={[demo.caption()]}>y: 4, blur: 6</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
