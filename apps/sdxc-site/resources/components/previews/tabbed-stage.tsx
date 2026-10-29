/**
 * Live preview for `TabbedStage`: two product views behind radio tabs with icons,
 * switching with CSS alone so the stage works before any script loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ActivityIcon, BellRingIcon } from "@sdxc/icons";
import { bg, fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { is, p } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { CodeStage, ProductFrame, TabbedStage } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<TabbedStage name="preview-stage" aria-label="Product views">
	<TabbedStage.Item value="monitors" label="Monitors" icon={<ActivityIcon />} defaultChecked>
		<ProductFrame lights title="Monitors" url="app.beacon.dev">
			<div mix={[vstack({ gap: 2, align: "stretch" }), p(6), bg("neutral.tint")]}>
				<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>api.example.com</span>
				<span mix={[font("mono"), text("xs"), fg("success")]}>Operational · 142 ms p95</span>
			</div>
		</ProductFrame>
	</TabbedStage.Item>
	<TabbedStage.Item value="alerts" label="Alerts" icon={<BellRingIcon />}>
		<CodeStage variant="terminal" title="alerts.log">
			14:02 UTC eu-west api.example.com 503, paged on-call
		</CodeStage>
	</TabbedStage.Item>
</TabbedStage>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<TabbedStage name="preview-stage" aria-label="Product views">
				<TabbedStage.Item value="monitors" label="Monitors" icon={<ActivityIcon />} defaultChecked>
					<ProductFrame lights title="Monitors" url="app.beacon.dev">
						<div mix={[vstack({ gap: 2, align: "stretch" }), p(6), bg("neutral.tint")]}>
							<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
								api.example.com
							</span>
							<span mix={[font("mono"), text("xs"), fg("success")]}>Operational · 142 ms p95</span>
						</div>
					</ProductFrame>
				</TabbedStage.Item>
				<TabbedStage.Item value="alerts" label="Alerts" icon={<BellRingIcon />}>
					<CodeStage variant="terminal" title="alerts.log">
						14:02 UTC eu-west api.example.com 503, paged on-call
					</CodeStage>
				</TabbedStage.Item>
			</TabbedStage>
		</div>
	),
};
