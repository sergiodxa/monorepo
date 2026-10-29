/**
 * Live preview for `ProductFrame`: a product shot in window chrome with traffic lights, a
 * title and an address bar, the way a landing stages its screenshots.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { is, p } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { ProductFrame } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<ProductFrame lights title="Monitors" url="app.beacon.dev">
	<div mix={[vstack({ gap: 2, align: "stretch" }), p(6), bg("neutral.tint")]}>
		<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>api.example.com</span>
		<span mix={[font("mono"), text("xs"), fg("success")]}>Operational · 142 ms p95</span>
	</div>
</ProductFrame>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<ProductFrame lights title="Monitors" url="app.beacon.dev">
				<div mix={[vstack({ gap: 2, align: "stretch" }), p(6), bg("neutral.tint")]}>
					<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
						api.example.com
					</span>
					<span mix={[font("mono"), text("xs"), fg("success")]}>Operational · 142 ms p95</span>
				</div>
			</ProductFrame>
		</div>
	),
};
