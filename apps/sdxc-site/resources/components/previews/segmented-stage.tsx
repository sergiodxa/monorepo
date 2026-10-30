/**
 * Live preview for `SegmentedStage` as hero media: a landing hero whose stage switches
 * between the status page, an incident and the API behind a centred pill control. It
 * switches with CSS alone and keeps one height, so the page below never jumps.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, HeadingScope, LinkButton } from "@sdxc/ui";
import { CodeStage, LandingHero, ProductFrame, SegmentedStage } from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

import { IncidentCard, StatusBoard } from "~/resources/components/demo-media";

/** The request the API panel shows. */
const SNIPPET = `let response = await fetch("https://api.beacon.dev/v1/monitors", {
	method: "POST",
	headers: { authorization: \`Bearer \${token}\` },
	body: JSON.stringify({ url: "https://api.example.com/health", every: "30s" }),
});`;

/** The source the page shows, matching the markup below. */
const CODE = `<LandingHero
	title="Know it is down before your users do"
	description="Checks from six regions, and a status page your customers trust."
	actions={…}
	media={
		<SegmentedStage name="hero-views" aria-label="Product views">
			<SegmentedStage.Item value="status" label="Status page" defaultChecked>
				<ProductFrame lights title="Status" url="status.example.com">
					<StatusBoard />
				</ProductFrame>
			</SegmentedStage.Item>
			<SegmentedStage.Item value="incident" label="Incidents">
				<ProductFrame lights title="Incident" url="app.beacon.dev">
					<IncidentCard />
				</ProductFrame>
			</SegmentedStage.Item>
			<SegmentedStage.Item value="api" label="API">
				<CodeStage variant="slab" title="create-monitor.ts" language="ts">{snippet}</CodeStage>
			</SegmentedStage.Item>
		</SegmentedStage>
	}
/>`;

/** What the preview registry reads: the source to show, and the hero to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<LandingHero
				title="Know it is down before your users do"
				description={
					<>
						Checks from six regions, alerts that only fire when <strong>two regions agree</strong>,
						and a status page your customers trust.
					</>
				}
				actions={
					<>
						<Button color="brand" mix={[marketingCtaChrome()]}>
							Start free
						</Button>
						<LinkButton href="/examples/pricing" variant="surface" mix={[marketingCtaChrome()]}>
							See pricing
						</LinkButton>
					</>
				}
				media={
					<SegmentedStage name="preview-hero-views" aria-label="Product views">
						<SegmentedStage.Item value="status" label="Status page" defaultChecked>
							<ProductFrame lights title="Status" url="status.example.com">
								<StatusBoard />
							</ProductFrame>
						</SegmentedStage.Item>
						<SegmentedStage.Item value="incident" label="Incidents">
							<ProductFrame lights title="Incident" url="app.beacon.dev">
								<IncidentCard />
							</ProductFrame>
						</SegmentedStage.Item>
						<SegmentedStage.Item value="api" label="API">
							<CodeStage variant="slab" title="create-monitor.ts" language="ts">
								{SNIPPET}
							</CodeStage>
						</SegmentedStage.Item>
					</SegmentedStage>
				}
			/>
		</HeadingScope>
	),
};
