/**
 * What Pulse says about one service wherever it shows it, in the peek sheet beside the list
 * and on the service's own page: its facts as named rows and its incidents and deploys as one
 * quiet timeline, newest first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CircleAlertIcon, CircleCheckIcon, RocketIcon, RotateCcwIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { font } from "@sdxc/u/typography";
import { PropertyList, RelativeTime, StatusDot, Timeline } from "@sdxc/ui";

import type { Service } from "./data";

import { DEPLOYS, INCIDENTS, LOCALE, NOW, REGIONS, uptimeRatio } from "./data";
import { COPY, STATUS } from "./labels";
import { MILLISECONDS, PERCENT } from "./parts";

/** How the check interval reads ("30 seconds", "1 hour"). */
function intervalLabel(seconds: number): string {
	let known = COPY.service.intervals as Record<number, string>;
	return known[seconds] ?? `${seconds}s`;
}

/** The service's facts, each a label and a value, with a named empty for what isn't known. */
export function ServiceProperties(handle: Handle<{ service: Service }>) {
	return () => {
		let { service } = handle.props;
		let uptime = uptimeRatio(service);
		return (
			<PropertyList>
				<PropertyList.Item label={COPY.services.columns.status}>
					<StatusDot color={STATUS[service.status].color}>{STATUS[service.status].label}</StatusDot>
				</PropertyList.Item>
				<PropertyList.Item label={COPY.service.endpoint}>
					<span mix={[font("mono"), raw({ overflowWrap: "anywhere" })]}>{service.endpoint}</span>
				</PropertyList.Item>
				<PropertyList.Item label={COPY.service.kind}>{service.kind}</PropertyList.Item>
				<PropertyList.Item label={COPY.service.region}>{REGIONS[service.region]}</PropertyList.Item>
				<PropertyList.Item label={COPY.service.owner}>{service.owner}</PropertyList.Item>
				<PropertyList.Item label={COPY.service.version}>
					<span mix={[font("mono")]}>{service.version}</span>
				</PropertyList.Item>
				<PropertyList.Item label={COPY.services.columns.latency} empty="—">
					{service.latencyMs === null ? undefined : (
						<span mix={[font("mono")]}>{MILLISECONDS.format(service.latencyMs)}</span>
					)}
				</PropertyList.Item>
				<PropertyList.Item label={COPY.service.errorRate} empty="—">
					{service.errorRate === null ? undefined : (
						<span mix={[font("mono")]}>
							{service.errorRate === 0 ? COPY.service.noErrors : PERCENT.format(service.errorRate)}
						</span>
					)}
				</PropertyList.Item>
				<PropertyList.Item label={COPY.service.uptime} empty="—">
					{uptime === null ? undefined : <span mix={[font("mono")]}>{PERCENT.format(uptime)}</span>}
				</PropertyList.Item>
				<PropertyList.Item label={COPY.service.interval}>
					{intervalLabel(service.interval)}
				</PropertyList.Item>
				<PropertyList.Item label={COPY.service.lastChecked}>
					<RelativeTime date={service.checkedAt} now={NOW} locale={LOCALE} />
				</PropertyList.Item>
			</PropertyList>
		);
	};
}

/** One entry of a service's history, deploys and incidents read as one stream. */
interface ActivityEntry {
	at: string;
	kind: "deploy" | "rollback" | "opened" | "resolved";
	actor: string;
	body: string;
}

/**
 * Every deploy and incident of a service, newest first: an incident adds its opening and, once
 * resolved, its resolution, so the timeline reads the way the night went.
 *
 * @param serviceId The service to read the history of.
 * @returns The entries, newest first.
 */
export function serviceActivity(serviceId: string): ActivityEntry[] {
	let entries: ActivityEntry[] = [];
	for (let deploy of DEPLOYS) {
		if (deploy.service !== serviceId) continue;
		entries.push({
			at: deploy.at,
			kind: deploy.outcome === "live" ? "deploy" : "rollback",
			actor: deploy.author,
			body:
				deploy.outcome === "live"
					? COPY.service.deployed(deploy.version)
					: COPY.service.rolledBack(deploy.version),
		});
	}
	for (let incident of INCIDENTS) {
		if (incident.service !== serviceId) continue;
		entries.push({
			at: incident.startedAt,
			kind: "opened",
			actor: incident.commander,
			body: COPY.service.opened(incident.id, incident.title),
		});
		if (incident.resolvedAt !== null) {
			entries.push({
				at: incident.resolvedAt,
				kind: "resolved",
				actor: incident.commander,
				body: COPY.service.resolved(incident.id),
			});
		}
	}
	return entries.sort((a, b) => b.at.localeCompare(a.at));
}

/** The icon and tone each kind of entry draws with. */
const ACTIVITY_LOOK = {
	deploy: { icon: RocketIcon, tone: "brand" },
	rollback: { icon: RotateCcwIcon, tone: "warning" },
	opened: { icon: CircleAlertIcon, tone: "danger" },
	resolved: { icon: CircleCheckIcon, tone: "success" },
} as const;

namespace ServiceTimeline {
	export interface Props {
		service: Service;
		/** How many entries show before the rest fold under "N older events". */
		limit?: number;
	}
}

/** A service's incidents and deploys as a timeline, with older entries folded away. */
export function ServiceTimeline(handle: Handle<ServiceTimeline.Props>) {
	return () => {
		let { service, limit = 4 } = handle.props;
		let entries = serviceActivity(service.id);
		let shown = entries.slice(0, limit);
		let rest = entries.slice(limit);
		let event = (entry: ActivityEntry) => {
			let look = ACTIVITY_LOOK[entry.kind];
			let Icon = look.icon;
			return (
				<Timeline.Event
					key={`${entry.kind}-${entry.at}`}
					icon={<Icon />}
					tone={look.tone}
					actor={entry.actor}
					time={<RelativeTime date={entry.at} now={NOW} locale={LOCALE} />}
				>
					{entry.body}
				</Timeline.Event>
			);
		};
		if (entries.length === 0) {
			return (
				<p mix={[raw({ margin: "0", color: "var(--ui-neutral-fg-muted)" })]}>
					{COPY.service.noActivity}
				</p>
			);
		}
		return (
			<Timeline aria-label={COPY.service.activity}>
				{shown.map(event)}
				{rest.length === 0 ? null : (
					<Timeline.More summary={COPY.service.more(rest.length)}>{rest.map(event)}</Timeline.More>
				)}
			</Timeline>
		);
	};
}
