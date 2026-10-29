/**
 * Live preview for `FeatureBand`: the split layout, a chapter header and checked claims
 * beside a framed product shot. A band is a page-width surface, so it meets the frame's
 * edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { HeadingScope } from "@sdxc/ui";
import { FeatureBand, ProductFrame } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<FeatureBand
	layout="split"
	eyebrow="Monitoring"
	title="Every endpoint, every region"
	description="Probes agree before they page anyone, so a blip in one region stays a blip."
	media={
		<ProductFrame lights title="Monitors" url="app.beacon.dev">
			<div mix={[vstack({ gap: 2, align: "stretch" }), p(6), bg("neutral.tint")]}>
				<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>api.example.com</span>
				<span mix={[font("mono"), text("xs"), fg("success")]}>Operational · 142 ms p95</span>
			</div>
		</ProductFrame>
	}
>
	<ul>
		<li>Checks every thirty seconds</li>
		<li>Six probe regions</li>
		<li>Latency tracked per region</li>
	</ul>
</FeatureBand>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	flush: true,
	render: () => (
		<HeadingScope>
			<FeatureBand
				layout="split"
				eyebrow="Monitoring"
				title="Every endpoint, every region"
				description="Probes agree before they page anyone, so a blip in one region stays a blip."
				media={
					<ProductFrame lights title="Monitors" url="app.beacon.dev">
						<div mix={[vstack({ gap: 2, align: "stretch" }), p(6), bg("neutral.tint")]}>
							<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
								api.example.com
							</span>
							<span mix={[font("mono"), text("xs"), fg("success")]}>Operational · 142 ms p95</span>
						</div>
					</ProductFrame>
				}
			>
				<ul>
					<li>Checks every thirty seconds</li>
					<li>Six probe regions</li>
					<li>Latency tracked per region</li>
				</ul>
			</FeatureBand>
		</HeadingScope>
	),
};
