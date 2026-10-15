/**
 * The opening `backdropDropShadow` example: a see-through pane over an icon, so the reader
 * sees the shadow traced on the shape that shows through the pane.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backdropDropShadow } from "@sdxc/u/effects";
import { willChange } from "@sdxc/u/general";
import { zstack } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** Drop shadows traced on the icon behind a see-through pane. */
export default {
	title: "Basic example",
	description:
		'Use `backdropDropShadow()` to shadow the shapes showing through an element. It traces what is painted inside the nearest backdrop root, like a parent with `willChange("filter")`:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<div mix={[zstack(), willChange("filter")]}>
					<svg viewBox="0 0 24 24" mix={[demo.icon()]}>
						<path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7z" />
					</svg>
					<div mix={[backdropDropShadow(), demo.glass()]} />
				</div>
				<span mix={[demo.caption()]}>default</span>
			</div>
			<div mix={[demo.figure()]}>
				<div mix={[zstack(), willChange("filter")]}>
					<svg viewBox="0 0 24 24" mix={[demo.icon()]}>
						<path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7z" />
					</svg>
					<div mix={[backdropDropShadow({ x: 2, y: 2, blur: 1 }), demo.glass()]} />
				</div>
				<span mix={[demo.caption()]}>x: 2, y: 2, blur: 1</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
