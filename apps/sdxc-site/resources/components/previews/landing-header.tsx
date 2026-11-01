/**
 * Live preview for `LandingHeader`: the default mono eyebrow over a chapter title and a
 * lead, then the other eyebrow looks — a linked quiet pill, a soft pill, the brand pill
 * centered, and a numbered chapter — each opening the band it would head.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is, m, maxIs } from "@sdxc/u/size";
import { HeadingScope } from "@sdxc/ui";
import { LandingHeader } from "@sdxc/ui/landing";

/** The source the page shows, matching the markup below. */
const CODE = `<LandingHeader
	eyebrow="Monitoring"
	description={
		<>
			Checks run every thirty seconds from six regions, and an alert only fires when{" "}
			<strong>two of them agree</strong>.
		</>
	}
>
	Know it is down before your users do
</LandingHeader>

<LandingHeader
	eyebrow="Status pages now support custom domains"
	eyebrowVariant="quiet"
	eyebrowHref="/examples/changelog/custom-domains"
	description="Point status.yourcompany.com at the page and we issue the certificate."
>
	Your status page, on your domain
</LandingHeader>

<LandingHeader eyebrow="Alerting" eyebrowVariant="soft" description="…">
	Page the right person, once
</LandingHeader>

<LandingHeader eyebrow="New" eyebrowVariant="pill" align="center" description="…">
	Multi-region checks on every plan
</LandingHeader>

<LandingHeader
	eyebrow="Incidents"
	eyebrowVariant="numbered"
	eyebrowIndex="02"
	description="…"
>
	Every incident writes its own timeline
</LandingHeader>`;

/** What the preview registry reads: the source to show, and the headers to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), maxIs("44rem"), vstack({ gap: 12, align: "stretch" })]}>
			<HeadingScope>
				<LandingHeader
					eyebrow="Monitoring"
					description={
						<>
							Checks run every thirty seconds from six regions, and an alert only fires when{" "}
							<strong>two of them agree</strong>.
						</>
					}
					mix={[m(0)]}
				>
					Know it is down before your users do
				</LandingHeader>
			</HeadingScope>
			<HeadingScope>
				<LandingHeader
					eyebrow="Status pages now support custom domains"
					eyebrowVariant="quiet"
					eyebrowHref="/examples/changelog/custom-domains"
					description="Point status.yourcompany.com at the page and we issue the certificate."
					mix={[m(0)]}
				>
					Your status page, on your domain
				</LandingHeader>
			</HeadingScope>
			<HeadingScope>
				<LandingHeader
					eyebrow="Alerting"
					eyebrowVariant="soft"
					description="Escalation policies follow the on-call rotation, so one failure pages one person."
					mix={[m(0)]}
				>
					Page the right person, once
				</LandingHeader>
			</HeadingScope>
			<HeadingScope>
				<LandingHeader
					eyebrow="New"
					eyebrowVariant="pill"
					align="center"
					description="Every monitor now checks from six regions, on the free plan too."
					mix={[m(0)]}
				>
					Multi-region checks on every plan
				</LandingHeader>
			</HeadingScope>
			<HeadingScope>
				<LandingHeader
					eyebrow="Incidents"
					eyebrowVariant="numbered"
					eyebrowIndex="02"
					description="Status changes, acknowledgements and fixes land on one record your postmortem starts from."
					mix={[m(0)]}
				>
					Every incident writes its own timeline
				</LandingHeader>
			</HeadingScope>
		</div>
	),
};
