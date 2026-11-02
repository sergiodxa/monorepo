/**
 * What Pulse says about one service wherever it shows it, in the peek sheet beside the list
 * and on the service's own page: its facts as named rows and its incidents and deploys as one
 * quiet timeline, newest first.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { CircleAlertIcon, CircleCheckIcon, RocketIcon, RotateCcwIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { overflowY } from "@sdxc/u/overflow";
import { bs, minIs } from "@sdxc/u/size";
import { font, truncate } from "@sdxc/u/typography";
import { PropertyList, RelativeTime, StatusDot, Timeline } from "@sdxc/ui";
import { Skeleton } from "@sdxc/ui/app/skeleton";

import type { Service } from "./data";

import { DEPLOYS, INCIDENTS, LOCALE, NOW, REGIONS, uptimeRatio } from "./data";
import { COPY, STATUS } from "./labels";
import { ghostText, MILLISECONDS, PERCENT } from "./parts";

/** How the check interval reads ("30 seconds", "1 hour"). */
function intervalLabel(seconds: number): string {
	let known = COPY.service.intervals as Record<number, string>;
	return known[seconds] ?? `${seconds}s`;
}

/** One fact of a service: its label, and its value or `undefined` when it isn't known. */
interface PropertyRow {
	label: string;
	value: (service: Service) => RemixNode | undefined;
}

/**
 * Every fact a service shows, in order. Each value holds one line, the endpoint truncating,
 * so the list is as tall as its placeholder whatever the service.
 */
const PROPERTY_ROWS: readonly PropertyRow[] = [
	{
		label: COPY.services.columns.status,
		value: (service) => (
			<StatusDot color={STATUS[service.status].color}>{STATUS[service.status].label}</StatusDot>
		),
	},
	{
		label: COPY.service.endpoint,
		value: (service) => (
			<span title={service.endpoint} mix={[font("mono"), minIs(0), truncate()]}>
				{service.endpoint}
			</span>
		),
	},
	{ label: COPY.service.kind, value: (service) => service.kind },
	{ label: COPY.service.region, value: (service) => REGIONS[service.region] },
	{ label: COPY.service.owner, value: (service) => service.owner },
	{
		label: COPY.service.version,
		value: (service) => <span mix={[font("mono")]}>{service.version}</span>,
	},
	{
		label: COPY.services.columns.latency,
		value: (service) =>
			service.latencyMs === null ? undefined : (
				<span mix={[font("mono")]}>{MILLISECONDS.format(service.latencyMs)}</span>
			),
	},
	{
		label: COPY.service.errorRate,
		value: (service) =>
			service.errorRate === null ? undefined : (
				<span mix={[font("mono")]}>
					{service.errorRate === 0 ? COPY.service.noErrors : PERCENT.format(service.errorRate)}
				</span>
			),
	},
	{
		label: COPY.service.uptime,
		value: (service) => {
			let uptime = uptimeRatio(service);
			return uptime === null ? undefined : (
				<span mix={[font("mono")]}>{PERCENT.format(uptime)}</span>
			);
		},
	},
	{ label: COPY.service.interval, value: (service) => intervalLabel(service.interval) },
	{
		label: COPY.service.lastChecked,
		value: (service) => <RelativeTime date={service.checkedAt} now={NOW} locale={LOCALE} />,
	},
];

/** The service's facts, each a label and a value, with a named empty for what isn't known. */
export function ServiceProperties(handle: Handle<{ service: Service }>) {
	return () => {
		let { service } = handle.props;
		return (
			<PropertyList>
				{PROPERTY_ROWS.map((row) => (
					<PropertyList.Item key={row.label} label={row.label} empty="—">
						{row.value(service)}
					</PropertyList.Item>
				))}
			</PropertyList>
		);
	};
}

/** The text the endpoint's placeholder bar is drawn from, about as long as a real endpoint. */
const PLACEHOLDER_ENDPOINT = "https://northwind.example";

/** The text every other value's placeholder bar is drawn from. */
const PLACEHOLDER_VALUE = "Placeholder";

/** The facts' placeholder: every label, with a bar where each value lands. */
export function ServicePropertiesPlaceholder() {
	return () => (
		<div aria-hidden="true">
			<PropertyList>
				{PROPERTY_ROWS.map((row, index) => (
					<PropertyList.Item key={row.label} label={row.label}>
						<span mix={[ghostText()]}>
							{index === 1 ? PLACEHOLDER_ENDPOINT : PLACEHOLDER_VALUE}
						</span>
					</PropertyList.Item>
				))}
			</PropertyList>
		</div>
	);
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

namespace ActivityBox {
	export interface Props {
		/** The service whose history the box holds, which sets how tall it stands. */
		service: Service;
		children: RemixNode;
	}
}

/**
 * The box a service's history scrolls in: one line tall for a quiet service, else a fixed
 * height whatever the events and however their lines wrap, so the history landing moves
 * nothing below it.
 */
export function ActivityBox(handle: Handle<ActivityBox.Props>) {
	return () => {
		let { service, children } = handle.props;
		let size = serviceActivity(service.id).length === 0 ? "1.5rem" : "11rem";
		return (
			<div
				role="region"
				aria-label={COPY.service.activity}
				mix={[bs(size), overflowY("auto"), minIs(0), raw({ overscrollBehavior: "contain" })]}
			>
				{children}
			</div>
		);
	};
}

namespace ServiceTimelinePlaceholder {
	export interface Props {
		service: Service;
		/** The timeline's own limit, so the placeholder draws as many rows as it shows. */
		limit: number;
	}
}

/** The history's placeholder: a row per event the timeline shows, inside its {@link ActivityBox}. */
export function ServiceTimelinePlaceholder(handle: Handle<ServiceTimelinePlaceholder.Props>) {
	return () => {
		let { service, limit } = handle.props;
		let rows = Math.min(serviceActivity(service.id).length, limit);
		return (
			<div aria-hidden="true">
				{rows === 0 ? null : <Skeleton.List rows={rows} avatar lines={1} />}
			</div>
		);
	};
}

/** How many events the peek sheet's history shows before folding the rest. */
const PEEK_LIMIT = 3;

/** The peek sheet's body: the service's facts, then its latest history. */
export function PeekBody(handle: Handle<{ service: Service }>) {
	return () => {
		let { service } = handle.props;
		return (
			<div mix={[vstack({ gap: 5, align: "stretch" }), minIs(0)]}>
				<ServiceProperties service={service} />
				<ActivityBox service={service}>
					<ServiceTimeline service={service} limit={PEEK_LIMIT} />
				</ActivityBox>
			</div>
		);
	};
}

/** The peek sheet body's placeholder, at the body's final size. */
export function PeekPlaceholder(handle: Handle<{ service: Service }>) {
	return () => {
		let { service } = handle.props;
		return (
			<div mix={[vstack({ gap: 5, align: "stretch" }), minIs(0)]}>
				<ServicePropertiesPlaceholder />
				<ActivityBox service={service}>
					<ServiceTimelinePlaceholder service={service} limit={PEEK_LIMIT} />
				</ActivityBox>
			</div>
		);
	};
}
