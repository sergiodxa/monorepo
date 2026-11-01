/**
 * Live preview for `DetailSheet`: a monitors list with one monitor open beside it, its
 * properties and recent activity in the sheet. The frame contains the sheet's fixed
 * position, so it docks to the preview's edge rather than the page's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CircleCheckIcon, CircleDotIcon, RocketIcon } from "@sdxc/icons";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle } from "@sdxc/u/general";
import { contain, hstack, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, is, m, p, pb, pi } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Badge, Button } from "@sdxc/ui";
import { DetailSheet } from "@sdxc/ui/app/detail-sheet";
import { PropertyList } from "@sdxc/ui/property-list";
import { Timeline } from "@sdxc/ui/timeline";

/** The source the page shows, matching the markup below. */
const CODE = `{selected ? (
	<DetailSheet
		id="monitor"
		title="api.example.com"
		description="HTTPS · every 30 seconds"
		closeHref="/monitors#monitor-3"
		permalink="/monitors/3"
		position={{ index: 3, total: 84, previousHref: "/monitors?pane=2", nextHref: "/monitors?pane=4" }}
		footer={<Button variant="outline">Pause monitor</Button>}
		labels={{
			close: "Close",
			copyLink: "Copy link",
			linkCopied: "Link copied",
			previous: "Previous monitor",
			next: "Next monitor",
			position: "Monitor",
		}}
	>
		<PropertyList>…</PropertyList>
		<Timeline aria-label="Recent activity">…</Timeline>
	</DetailSheet>
) : null}`;

/** The monitors the list behind the sheet shows. */
const MONITORS = [
	{ id: 1, host: "app.example.com", status: "Up" },
	{ id: 2, host: "auth.example.com", status: "Up" },
	{ id: 3, host: "api.example.com", status: "Up" },
	{ id: 4, host: "cdn.example.com", status: "Degraded" },
	{ id: 5, host: "status.example.com", status: "Up" },
];

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				is("full"),
				bs("36rem"),
				contain("layout paint"),
				overflow("hidden"),
				rounded("lg"),
				border({ color: "neutral.border", width: 1 }),
				bg("neutral.tint"),
			]}
		>
			<ul mix={[m(0), p(3), listStyle("none"), vstack({ gap: 1 }), is("50%")]}>
				{MONITORS.map((monitor) => (
					<li key={monitor.id}>
						<a
							href={`#monitor-${monitor.id}`}
							aria-current={monitor.id === 3 ? "page" : undefined}
							mix={[
								hstack({ gap: 2, align: "center", justify: "between" }),
								pi(3),
								pb(2),
								rounded("md"),
								text("sm"),
								fg(),
								monitor.id === 3 ? bg() : null,
							]}
						>
							<span mix={[weight("medium")]}>{monitor.host}</span>
							<Badge color={monitor.status === "Up" ? "success" : "warning"} variant="secondary">
								{monitor.status}
							</Badge>
						</a>
					</li>
				))}
			</ul>
			<DetailSheet
				id="preview-monitor"
				title="api.example.com"
				description="HTTPS · every 30 seconds"
				closeHref="#monitor-3"
				permalink="#monitor-3"
				position={{ index: 3, total: 84, previousHref: "#monitor-2", nextHref: "#monitor-4" }}
				footer={<Button variant="outline">Pause monitor</Button>}
				labels={{
					close: "Close",
					copyLink: "Copy link",
					linkCopied: "Link copied",
					previous: "Previous monitor",
					next: "Next monitor",
					position: "Monitor",
				}}
				keys="sheet"
			>
				<PropertyList>
					<PropertyList.Item label="Status">
						<Badge color="success">Up for 12 days</Badge>
					</PropertyList.Item>
					<PropertyList.Item label="Regions">Frankfurt, São Paulo, Singapore</PropertyList.Item>
					<PropertyList.Item label="Response">212 ms median</PropertyList.Item>
					<PropertyList.Item label="Escalation" empty="No policy" />
				</PropertyList>
				<Timeline aria-label="Recent activity">
					<Timeline.Event icon={<CircleDotIcon />} tone="danger" actor="Uptime" time="2d ago">
						opened an incident from 3 regions
					</Timeline.Event>
					<Timeline.Event icon={<RocketIcon />} tone="brand" actor="deploy-bot" time="2d ago">
						deployed v4.2.0
					</Timeline.Event>
					<Timeline.Event icon={<CircleCheckIcon />} tone="success" actor="Uptime" time="2d ago">
						resolved the incident after 12 minutes
					</Timeline.Event>
				</Timeline>
			</DetailSheet>
		</div>
	),
};
