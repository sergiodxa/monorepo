/**
 * Live example for a sticky `PageHeader` on a long incident page: scroll the frame and the
 * header holds at the top, folding its trail and description away and shrinking the title,
 * so the incident's name and its primary action stay in reach.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { text } from "@sdxc/u/typography";
import { Badge, Button } from "@sdxc/ui";
import { PageHeader } from "@sdxc/ui/app/page-header";

/** The incident's timeline entries that give the frame something to scroll. */
const UPDATES = [
	"14:02 checkout-api failed its check from Frankfurt and São Paulo.",
	"14:03 Paged the on-call engineer through the payments escalation policy.",
	"14:05 Error rate on /charge reached 38%; the status page shows a partial outage.",
	"14:11 Rolled back release 2026.11.1 of the checkout service.",
	"14:14 Checks pass from every region; watching for 15 minutes before resolving.",
	"14:29 Resolved. Root cause: a connection pool sized for the old database.",
];

/** The source the page shows, matching the markup below. */
const CODE = `<PageHeader
	sticky
	crumbsLabel="Breadcrumb"
	crumbs={[{ label: "Incidents", href: "/incidents" }, { label: "INC-218" }]}
	title="Checkout API returning 502s"
	status={<Badge color="warning" variant="secondary">Monitoring</Badge>}
	description="Opened 14:02 by checkout-api · 27 minutes"
	primaryAction={<Button>Resolve</Button>}
/>`;

/** What the preview registry reads: the title, the source to show, and the scrolling page to draw. */
export default {
	title: "Sticky, compacting once stuck",
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					blockSize: "24rem",
					overflowY: "auto",
					paddingInline: "1rem",
					"--ui-app-gutter": "1rem",
				}),
			]}
		>
			<PageHeader
				sticky
				crumbsLabel="Breadcrumb"
				crumbs={[{ label: "Incidents", href: "#incidents" }, { label: "INC-218" }]}
				title="Checkout API returning 502s"
				status={
					<Badge color="warning" variant="secondary">
						Monitoring
					</Badge>
				}
				description="Opened 14:02 by checkout-api · 27 minutes"
				primaryAction={<Button size="sm">Resolve</Button>}
			/>
			{UPDATES.map((update) => (
				<p key={update} mix={[raw({ marginBlock: "0 4rem" }), text("sm"), fg("neutral.muted")]}>
					{update}
				</p>
			))}
		</div>
	),
};
