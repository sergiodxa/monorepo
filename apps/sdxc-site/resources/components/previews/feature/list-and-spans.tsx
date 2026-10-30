/**
 * Live example for two `Feature.Grid` arrangements: an un-carded `list` of six claims with
 * their icons beside the copy, and a card grid of mixed spans where the wide cells
 * alternate sides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	BellRingIcon,
	CalendarClockIcon,
	GaugeIcon,
	GlobeIcon,
	NewspaperIcon,
	UsersIcon,
} from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Feature } from "@sdxc/ui";

/** The claims both grids draw, as icon, title and body. */
const CLAIMS = [
	[GaugeIcon, "Probes from 12 regions", "A failure pages only once two regions agree."],
	[BellRingIcon, "On-call that escalates", "Unacknowledged alerts move to the next person."],
	[GlobeIcon, "Status on your domain", "Point status.yourcompany.com at Beacon."],
	[CalendarClockIcon, "Cron heartbeats", "Know when a scheduled job silently stops."],
	[UsersIcon, "Roles for every team", "Give support read-only access to incidents."],
	[NewspaperIcon, "Incident write-ups", "Draft the post-mortem from the timeline."],
] as const;

/** The source the page shows, matching the markup below. */
const CODE = `<Feature.Grid variant="list" columns={3}>
	<Feature>
		<Feature.Icon><GaugeIcon aria-hidden="true" /></Feature.Icon>
		<Feature.Title>Probes from 12 regions</Feature.Title>
		<Feature.Description>A failure pages only once two regions agree.</Feature.Description>
	</Feature>
	…
</Feature.Grid>

<Feature.Grid columns={3}>
	<Feature span={2}>…</Feature>
	<Feature>…</Feature>
	<Feature>…</Feature>
	<Feature span={2}>…</Feature>
</Feature.Grid>`;

/** What the preview registry reads: the title, the source to show, and the grids to draw. */
export default {
	title: "Icon list and mixed spans",
	code: CODE,
	viewports: true,
	render: () => (
		<div mix={[is("full"), vstack({ gap: 16, align: "stretch" })]}>
			<Feature.Grid variant="list" columns={3}>
				{CLAIMS.map(([Icon, title, body]) => (
					<Feature key={title}>
						<Feature.Icon>
							<Icon aria-hidden="true" />
						</Feature.Icon>
						<Feature.Title>{title}</Feature.Title>
						<Feature.Description>{body}</Feature.Description>
					</Feature>
				))}
			</Feature.Grid>
			<Feature.Grid columns={3}>
				{CLAIMS.slice(0, 4).map(([Icon, title, body], index) => (
					<Feature key={title} span={index === 0 || index === 3 ? 2 : undefined}>
						<Feature.Icon>
							<Icon aria-hidden="true" />
						</Feature.Icon>
						<Feature.Title>{title}</Feature.Title>
						<Feature.Description>{body}</Feature.Description>
					</Feature>
				))}
			</Feature.Grid>
		</div>
	),
};
