/**
 * Live preview for `MarketingSection`: a default plain band holding a header and its
 * actions, then a tinted inset panel and a brand band at the closing spacing. A band is a
 * page-width surface, so the preview meets the frame's edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	Button,
	CtaGroup,
	HeadingScope,
	LinkButton,
	MarketingHeader,
	MarketingSection,
} from "@sdxc/ui";
import { marketingCtaChrome } from "@sdxc/ui/styles";

/** The source the page shows, matching the markup below. */
const CODE = `<MarketingSection>
	<MarketingHeader
		eyebrow="Status pages"
		description={
			<>
				Publish incidents and maintenance from <strong>the dashboard your team already watches</strong>.
			</>
		}
	>
		Tell customers before they ask
	</MarketingHeader>
	<CtaGroup>
		<Button color="brand" mix={[marketingCtaChrome()]}>Create a status page</Button>
		<LinkButton href="/examples/status" variant="surface" mix={[marketingCtaChrome()]}>
			See an example
		</LinkButton>
	</CtaGroup>
</MarketingSection>

<MarketingSection tone="tinted" spacing="compact" inset>
	<MarketingHeader eyebrow="Integrations" description="…">
		Alerts where your team already talks
	</MarketingHeader>
</MarketingSection>

<MarketingSection tone="brand" spacing="cta" align="center" inset>
	<MarketingHeader description="…" align="center">
		Five monitors free, forever
	</MarketingHeader>
	<CtaGroup>…</CtaGroup>
</MarketingSection>`;

/** What the preview registry reads: the source to show, and the bands to draw edge to edge. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<MarketingSection>
				<MarketingHeader
					eyebrow="Status pages"
					description={
						<>
							Publish incidents and maintenance from{" "}
							<strong>the dashboard your team already watches</strong>.
						</>
					}
				>
					Tell customers before they ask
				</MarketingHeader>
				<CtaGroup>
					<Button color="brand" mix={[marketingCtaChrome()]}>
						Create a status page
					</Button>
					<LinkButton href="/examples/status" variant="surface" mix={[marketingCtaChrome()]}>
						See an example
					</LinkButton>
				</CtaGroup>
			</MarketingSection>
			<MarketingSection tone="tinted" spacing="compact" inset>
				<MarketingHeader
					eyebrow="Integrations"
					description="Slack, PagerDuty, Opsgenie and plain webhooks, wired in a minute each."
				>
					Alerts where your team already talks
				</MarketingHeader>
			</MarketingSection>
			<MarketingSection tone="brand" spacing="cta" align="center" inset>
				<MarketingHeader
					align="center"
					description="Six regions, thirty-second checks and a public status page, before you pay anything."
				>
					Five monitors free, forever
				</MarketingHeader>
				<CtaGroup>
					<Button color="neutral" mix={[marketingCtaChrome()]}>
						Start monitoring
					</Button>
					<LinkButton href="/examples/pricing" variant="surface" mix={[marketingCtaChrome()]}>
						Compare plans
					</LinkButton>
				</CtaGroup>
			</MarketingSection>
		</HeadingScope>
	),
};
