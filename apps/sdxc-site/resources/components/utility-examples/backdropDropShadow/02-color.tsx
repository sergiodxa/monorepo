/**
 * A `backdropDropShadow` example with a theme color, so the reader sees the `color`
 * option tint the shadow traced behind the pane.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { backdropDropShadow } from "@sdxc/u/effects";
import { willChange } from "@sdxc/u/general";
import { zstack } from "@sdxc/u/layout";

import type { UtilityExampleModule } from "~/resources/components/utility-example-registry.server";

import * as demo from "~/resources/components/utility-examples/demo";

/** A brand-tinted shadow traced behind a see-through pane. */
export default {
	title: "Changing the color",
	description: 'Pass a theme `color` to tint the traced shadow, like `color: "brand"`:',
	render: () => (
		<div mix={[demo.row()]}>
			<div mix={[demo.figure()]}>
				<div mix={[zstack(), willChange("filter")]}>
					<svg viewBox="0 0 24 24" mix={[demo.icon()]}>
						<path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7z" />
					</svg>
					<div mix={[backdropDropShadow({ y: 2, blur: 2, color: "brand" }), demo.glass()]} />
				</div>
				<span mix={[demo.caption()]}>color: "brand"</span>
			</div>
		</div>
	),
} satisfies UtilityExampleModule;
