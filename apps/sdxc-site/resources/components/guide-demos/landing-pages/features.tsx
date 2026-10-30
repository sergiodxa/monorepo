/**
 * The three feature bands from the landing-page guide: a split band beside an incident
 * screen, a tinted grid of three features, and a numbered steps band. A staged screen
 * stands in for the screenshot the guide's snippet loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellRingIcon, GaugeIcon, GlobeIcon } from "@sdxc/icons";
import { bg, fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { Badge, Feature, HeadingScope } from "@sdxc/ui";
import { FeatureBand, ProductFrame, StepList } from "@sdxc/ui/patterns";

/** What the guide demo registry reads: the three bands, drawn at a page's width. */
export default {
	viewports: true,
	render: () => (
		<HeadingScope>
			<FeatureBand
				layout="split"
				eyebrow="Incidents"
				title="Every incident writes its own timeline"
				media={
					<ProductFrame lights title="Incident">
						<div mix={[vstack({ gap: 3, align: "start" }), p(6), bg("neutral.tint")]}>
							<Badge color="warning" variant="secondary">
								Investigating
							</Badge>
							<span mix={[text("base"), weight("semibold"), fg("neutral.emphasis")]}>
								Elevated API latency in eu-west
							</span>
							<span mix={[font("mono"), text("xs"), fg("neutral.muted")]}>
								14:02 UTC · 2 responders
							</span>
						</div>
					</ProductFrame>
				}
			>
				<ul>
					<li>Status changes posted as they happen</li>
					<li>Responders and acknowledgements recorded</li>
					<li>One link to share with customers</li>
				</ul>
			</FeatureBand>

			<FeatureBand layout="grid" tone="tinted" title="Built for on-call" columns={3}>
				<Feature>
					<Feature.Icon>
						<GlobeIcon />
					</Feature.Icon>
					<Feature.Title>Six probe regions</Feature.Title>
					<Feature.Description>Every check runs from three continents.</Feature.Description>
				</Feature>
				<Feature>
					<Feature.Icon>
						<BellRingIcon />
					</Feature.Icon>
					<Feature.Title>Alerts that agree</Feature.Title>
					<Feature.Description>A page fires when two regions see it.</Feature.Description>
				</Feature>
				<Feature>
					<Feature.Icon>
						<GaugeIcon />
					</Feature.Icon>
					<Feature.Title>Latency per region</Feature.Title>
					<Feature.Description>Response time, beyond up or down.</Feature.Description>
				</Feature>
			</FeatureBand>

			<FeatureBand layout="steps" title="Live in three steps">
				<StepList.Item title="Add a monitor">Paste the URL you want watched.</StepList.Item>
				<StepList.Item title="Pick who gets paged">Route alerts to a rotation.</StepList.Item>
				<StepList.Item title="Share the status page">Customers subscribe to it.</StepList.Item>
			</FeatureBand>
		</HeadingScope>
	),
};
