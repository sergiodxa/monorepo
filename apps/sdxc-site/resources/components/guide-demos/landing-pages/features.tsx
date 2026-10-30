/**
 * The three feature bands from the landing-page guide: a split band beside an incident
 * screen, a tinted grid of three features, and a numbered steps band. A staged screen
 * stands in for the screenshot the guide's snippet loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellRingIcon, GaugeIcon, GlobeIcon } from "@sdxc/icons";
import { Feature } from "@sdxc/ui";
import { FeatureBand, ProductFrame, StepList } from "@sdxc/ui/patterns";

import { IncidentCard } from "~/resources/components/demo-media";

/** What the guide demo registry reads: the three bands, drawn at a page's width. */
export default {
	viewports: true,
	render: () => (
		<>
			<FeatureBand
				layout="split"
				eyebrow="Incidents"
				title="Incidents write their own record"
				description={
					<>
						Every state change lands on the timeline as it happens, so the{" "}
						<strong>post-mortem is already written</strong> when the page clears.
					</>
				}
				media={
					<ProductFrame shadow="stage" lights title="Incident #482">
						<IncidentCard />
					</ProductFrame>
				}
			>
				<ul>
					<li>Status changes posted as they happen</li>
					<li>Responders and acknowledgements recorded</li>
					<li>One link to share with customers</li>
				</ul>
			</FeatureBand>

			<FeatureBand
				layout="grid"
				tone="brand"
				inset
				eyebrow="On-call"
				title="Built for the 3 a.m. page"
				columns={3}
			>
				<Feature>
					<Feature.Icon>
						<GlobeIcon />
					</Feature.Icon>
					<Feature.Title>Six probe regions</Feature.Title>
					<Feature.Description>
						Every check runs from <strong>three continents</strong>, so a local outage never hides
						behind a healthy one.
					</Feature.Description>
				</Feature>
				<Feature>
					<Feature.Icon>
						<BellRingIcon />
					</Feature.Icon>
					<Feature.Title>Alerts that agree</Feature.Title>
					<Feature.Description>
						A page fires only when <strong>two regions</strong> see the failure, which keeps flaky
						networks off your phone.
					</Feature.Description>
				</Feature>
				<Feature>
					<Feature.Icon>
						<GaugeIcon />
					</Feature.Icon>
					<Feature.Title>Latency per region</Feature.Title>
					<Feature.Description>
						Response time is charted per region, so you see <strong>slow before down</strong>.
					</Feature.Description>
				</Feature>
			</FeatureBand>

			<FeatureBand layout="steps" eyebrow="Setup" title="Live in three steps">
				<StepList.Item title="Add a monitor">
					Paste the URL you want watched and pick the regions that check it.
				</StepList.Item>
				<StepList.Item title="Pick who gets paged">
					Route alerts to a rotation, a channel, or a single phone.
				</StepList.Item>
				<StepList.Item title="Share the status page">
					Customers subscribe and hear about incidents before they ask.
				</StepList.Item>
			</FeatureBand>
		</>
	),
};
