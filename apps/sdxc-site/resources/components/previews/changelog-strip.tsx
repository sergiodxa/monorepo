/**
 * Live preview for `ChangelogStrip`: four recent releases on one hairline under a band
 * header with a "View all" link. Four columns on a wide frame, pairs at tablet width, and a
 * snapping sideways row on a phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { HeadingScope, MarketingSection } from "@sdxc/ui";
import { ChangelogStrip } from "@sdxc/ui/patterns";

/** Releases the strip lists, newest first. */
const RELEASES = [
	{
		dateTime: "2026-10-28",
		date: "Oct 28, 2026",
		title: "Status pages on your own domain",
		body: "Point status.yourcompany.com at Beacon and we provision the certificate, no DNS tickets.",
		href: "/examples/changelog/status-domains",
	},
	{
		dateTime: "2026-10-14",
		date: "Oct 14, 2026",
		title: "Two-region confirmation",
		body: "A failure pages someone only after a second region sees it, so a flaky probe stays quiet.",
		href: "/examples/changelog/two-region",
	},
	{
		dateTime: "2026-09-30",
		date: "Sep 30, 2026",
		title: "Escalations in Slack",
		body: "Unacknowledged alerts move to the next person on the rotation, right in the channel.",
		href: "/examples/changelog/slack-escalation",
	},
	{
		dateTime: "2026-09-16",
		date: "Sep 16, 2026",
		title: "Maintenance windows",
		body: "Schedule planned downtime once; probes pause and the status page explains why.",
		href: "/examples/changelog/maintenance",
	},
] as const;

/** The source the page shows, matching the markup below. */
const CODE = `<MarketingSection>
	<ChangelogStrip title="Changelog" action={<a href="/changelog">View all →</a>}>
		<ChangelogStrip.Entry
			dateTime="2026-10-28"
			date="Oct 28, 2026"
			title="Status pages on your own domain"
			href="/changelog/status-domains"
		>
			Point status.yourcompany.com at Beacon and we provision the certificate, no DNS tickets.
		</ChangelogStrip.Entry>
		{/* …three more entries */}
	</ChangelogStrip>
</MarketingSection>`;

/** What the preview registry reads: the source to show, and the band to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<MarketingSection>
				<ChangelogStrip title="Changelog" action={<a href="/examples/changelog">View all →</a>}>
					{RELEASES.map((release) => (
						<ChangelogStrip.Entry
							key={release.dateTime}
							dateTime={release.dateTime}
							date={release.date}
							title={release.title}
							href={release.href}
						>
							{release.body}
						</ChangelogStrip.Entry>
					))}
				</ChangelogStrip>
			</MarketingSection>
		</HeadingScope>
	),
};
