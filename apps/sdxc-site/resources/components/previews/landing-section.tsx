/**
 * Live preview for `LandingSection`: a default plain band holding a header and its
 * actions, then a tinted inset panel and a brand band at the closing spacing. A band is a
 * page-width surface, so the preview meets the frame's edges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, CtaGroup, HeadingScope, LinkButton } from "@sdxc/ui";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

/** The source the page shows, matching the markup below. */
const CODE = `<LandingSection>
	<LandingHeader
		eyebrow="Status pages"
		description={
			<>
				Publish incidents and maintenance from <strong>the dashboard your team already watches</strong>.
			</>
		}
	>
		Tell customers before they ask
	</LandingHeader>
	<CtaGroup>
		<Button color="brand" mix={[landingCtaChrome()]}>Create a status page</Button>
		<LinkButton href="/examples/status" variant="surface" mix={[landingCtaChrome()]}>
			See an example
		</LinkButton>
	</CtaGroup>
</LandingSection>

<LandingSection tone="tinted" spacing="compact" inset>
	<LandingHeader eyebrow="Integrations" description="…">
		Alerts where your team already talks
	</LandingHeader>
</LandingSection>

<LandingSection tone="brand" spacing="cta" align="center" inset>
	<LandingHeader description="…" align="center">
		Five monitors free, forever
	</LandingHeader>
	<CtaGroup>…</CtaGroup>
</LandingSection>`;

/** What the preview registry reads: the source to show, and the bands to draw edge to edge. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<LandingSection>
				<LandingHeader
					eyebrow="Status pages"
					description={
						<>
							Publish incidents and maintenance from{" "}
							<strong>the dashboard your team already watches</strong>.
						</>
					}
				>
					Tell customers before they ask
				</LandingHeader>
				<CtaGroup>
					<Button color="brand" mix={[landingCtaChrome()]}>
						Create a status page
					</Button>
					<LinkButton href="/examples/status" variant="surface" mix={[landingCtaChrome()]}>
						See an example
					</LinkButton>
				</CtaGroup>
			</LandingSection>
			<LandingSection tone="tinted" spacing="compact" inset>
				<LandingHeader
					eyebrow="Integrations"
					description="Slack, PagerDuty, Opsgenie and plain webhooks, wired in a minute each."
				>
					Alerts where your team already talks
				</LandingHeader>
			</LandingSection>
			<LandingSection tone="brand" spacing="cta" align="center" inset>
				<LandingHeader
					align="center"
					description="Six regions, thirty-second checks and a public status page, before you pay anything."
				>
					Five monitors free, forever
				</LandingHeader>
				<CtaGroup>
					<Button color="neutral" mix={[landingCtaChrome()]}>
						Start monitoring
					</Button>
					<LinkButton href="/examples/pricing" variant="surface" mix={[landingCtaChrome()]}>
						Compare plans
					</LinkButton>
				</CtaGroup>
			</LandingSection>
		</HeadingScope>
	),
};
