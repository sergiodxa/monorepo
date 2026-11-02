/**
 * One service's page: a header with its trail, status, actions and tabs, then its latency
 * chart and 90-day strip beside its facts, and the incidents and deploys that explain both.
 * The settings tab holds its check form and, last, the irreversible delete.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { PauseIcon, PlayIcon, RefreshCwIcon } from "@sdxc/icons";
import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { bs, is, minIs } from "@sdxc/u/size";
import { font, nowrap, text } from "@sdxc/u/typography";
import { Button, HeadingScope, Input, Select, StatusDot } from "@sdxc/ui";
import { Chart } from "@sdxc/ui/app/chart";
import { DangerZone } from "@sdxc/ui/app/danger-zone";
import { Empty } from "@sdxc/ui/app/empty";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { SettingsSection } from "@sdxc/ui/app/settings-section";
import { StatusStrip } from "@sdxc/ui/app/status-strip";
import { Table } from "@sdxc/ui/app/table";

import type { DemoAppRequest } from "~/resources/views/demo-apps";

import DemoAppFrame from "~/resources/views/demo-apps/frame";

import type { Service } from "./data";

import { actionHref, href, INCIDENTS, LOCALE, NOW, REGIONS, uptimeDays, uptimeRatio } from "./data";
import { COPY, INCIDENT_STATUS, STATUS } from "./labels";
import { pick } from "./overview";
import { Panel, PERCENT } from "./parts";
import {
	ActivityBox,
	ServicePropertiesPlaceholder,
	ServiceTimelinePlaceholder,
} from "./service-parts";

/** The tabs a service's page splits into. */
type ServiceTab = "overview" | "checks" | "incidents" | "settings";

/** Every tab, in the order the header lists them. */
const TABS: readonly ServiceTab[] = ["overview", "checks", "incidents", "settings"];

/** The p95 the service is held to, drawn as the chart's threshold. */
const TARGET_MS = 400;

/** The regions a check runs from, each one row per check in the checks tab. */
const CHECK_REGIONS = Object.keys(REGIONS) as (keyof typeof REGIONS)[];

/**
 * The service's latest checks: one per region for the last three rounds, failing where the
 * service is down and slow where it is degraded, newest first.
 */
function recentChecks(service: Service) {
	let checks: {
		key: string;
		region: string;
		ok: boolean | null;
		latencyMs: number | null;
		at: string;
	}[] = [];
	for (let round = 0; round < 3; round++) {
		let at = new Date(
			Date.parse(service.checkedAt) - round * service.interval * 1000,
		).toISOString();
		CHECK_REGIONS.forEach((region, index) => {
			let paused = service.status === "paused";
			let ok = paused ? null : service.status !== "down";
			let base = service.latencyMs ?? 0;
			checks.push({
				key: `${round}-${region}`,
				region: REGIONS[region],
				ok,
				latencyMs: ok ? Math.round(base * (0.85 + index * 0.1)) : null,
				at,
			});
		});
	}
	return checks;
}

namespace ServicePage {
	export interface Props {
		request: DemoAppRequest;
		service: Service;
	}
}

/** The service chart's drawing box; the SVG scales to its column from this ratio. */
const SERVICE_CHART_SIZE = { width: 720, height: 220 } as const;

/**
 * The service's p95 latency over the last 16 hours, yesterday's same hours dashed behind it
 * and the target drawn as a threshold: the content of the `services/<id>/chart` frame.
 */
export function ServiceChart(handle: Handle<{ service: Service }>) {
	return () => {
		let { service } = handle.props;
		let last = service.latency.length - 1;
		let calm = service.latency.find((value) => value !== null) ?? 100;
		let yesterday = service.latency.map((_, index) =>
			Math.round(calm * (0.94 + Math.sin(index * 1.3) * 0.05)),
		);
		let ceiling = Math.max(TARGET_MS * 1.5, ...service.latency.map((value) => value ?? 0)) * 1.1;
		return (
			<Chart
				width={SERVICE_CHART_SIZE.width}
				height={SERVICE_CHART_SIZE.height}
				xDomain={[0, last]}
				yDomain={[0, ceiling]}
				aria-label={COPY.service.chart(service.name)}
			>
				<Chart.Line
					points={yesterday.map((y, x) => ({
						x,
						y,
						label: `Yesterday, ${16 - x} hours ago: ${y} ms`,
					}))}
					comparison
				/>
				<Chart.Line
					points={service.latency.map((y, x) => ({
						x,
						y,
						label: y === null ? COPY.overview.noData : `${16 - x} hours ago: ${y} ms`,
					}))}
				/>
				<Chart.Threshold y={TARGET_MS} label={COPY.service.threshold} tone="warning" />
			</Chart>
		);
	};
}

/** The service chart's placeholder: the plot's box at its final size. */
export function ServiceChartPlaceholder() {
	return () => (
		<div
			aria-hidden="true"
			mix={[
				is("100%"),
				raw({ aspectRatio: `${SERVICE_CHART_SIZE.width} / ${SERVICE_CHART_SIZE.height}` }),
				rounded("md"),
				bg("neutral.tint"),
			]}
		/>
	);
}

/** The service's last 90 days as a strip: the content of the `services/<id>/uptime` frame. */
export function ServiceUptime(handle: Handle<{ service: Service }>) {
	return () => {
		let { service } = handle.props;
		let uptime = uptimeRatio(service);
		return (
			<StatusStrip
				label={COPY.services.stripLabel(service.name)}
				summary={COPY.services.stripSummary(uptime === null ? "—" : PERCENT.format(uptime))}
				start={COPY.services.start}
				end={COPY.services.end}
				periods={uptimeDays(service, COPY.services.dayLabel)}
			/>
		);
	};
}

/** The strip's placeholder: the bars' row and the caption line under it, at their final size. */
export function ServiceUptimePlaceholder() {
	return () => (
		<div aria-hidden="true" mix={[vstack({ gap: 1.5, align: "stretch" })]}>
			<div
				mix={[bs("var(--ui-status-strip-block-size, 2rem)"), rounded("sm"), bg("neutral.tint")]}
			/>
			<span mix={[text("xs"), raw({ visibility: "hidden" })]}>&nbsp;</span>
		</div>
	);
}

/**
 * The service's overview tab: chart and strip beside its facts, then its history. Every panel
 * keeps its heading in the page and streams its body in as its own frame.
 */
function OverviewTab(handle: Handle<{ service: Service }>) {
	return () => {
		let { service } = handle.props;
		let part = (name: string) => `services/${service.id}/${name}`;
		return (
			<div
				mix={[
					raw({
						containerType: "inline-size",
						display: "grid",
						gap: "1rem",
						gridTemplateColumns: "minmax(0, 1fr)",
						"@container (min-width: 60rem)": { gridTemplateColumns: "minmax(0, 1fr) 20rem" },
					}),
				]}
			>
				<div mix={[vstack({ gap: 4, align: "stretch" }), minIs(0)]}>
					<Panel
						id="pulse-service-chart"
						title={COPY.service.chartTitle}
						description={COPY.service.chartHint}
					>
						<DemoAppFrame app="pulse" part={part("chart")} fallback={<ServiceChartPlaceholder />} />
					</Panel>
					<Panel id="pulse-service-uptime" title={COPY.service.uptime}>
						<DemoAppFrame
							app="pulse"
							part={part("uptime")}
							fallback={<ServiceUptimePlaceholder />}
						/>
					</Panel>
					<Panel id="pulse-service-activity" title={COPY.service.activity}>
						<ActivityBox service={service}>
							<DemoAppFrame
								app="pulse"
								part={part("activity")}
								fallback={<ServiceTimelinePlaceholder service={service} limit={4} />}
							/>
						</ActivityBox>
					</Panel>
				</div>
				<Panel id="pulse-service-details" title={COPY.service.properties}>
					<DemoAppFrame
						app="pulse"
						part={part("details")}
						fallback={<ServicePropertiesPlaceholder />}
					/>
				</Panel>
			</div>
		);
	};
}

/** The checks tab: the last three rounds of checks from every region. */
function ChecksTab(handle: Handle<{ service: Service }>) {
	return () => {
		let { service } = handle.props;
		return (
			<Panel id="pulse-service-checks" title={COPY.service.checksTable} flush>
				<Table.Container>
					<Table aria-label={COPY.service.checksTable} density="compact">
						<Table.Header>
							<Table.Row>
								<Table.Column>{COPY.service.checkColumns.region}</Table.Column>
								<Table.Column>{COPY.service.checkColumns.result}</Table.Column>
								<Table.Column numeric>{COPY.service.checkColumns.latency}</Table.Column>
								<Table.Column>{COPY.service.checkColumns.at}</Table.Column>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{recentChecks(service).map((check) => (
								<Table.Row key={check.key}>
									<Table.Cell>{check.region}</Table.Cell>
									<Table.StatusCell color={STATUS[checkStatus(check.ok)].color}>
										{STATUS[checkStatus(check.ok)].label}
									</Table.StatusCell>
									<Table.NumberCell
										value={check.latencyMs}
										locale={LOCALE}
										format={{ style: "unit", unit: "millisecond" }}
										mix={[font("mono"), nowrap()]}
									/>
									<Table.DateCell date={check.at} now={NOW} locale={LOCALE} />
								</Table.Row>
							))}
						</Table.Body>
					</Table>
				</Table.Container>
			</Panel>
		);
	};
}

/** The status word a check's result reads as. */
function checkStatus(ok: boolean | null): "up" | "down" | "paused" {
	if (ok === null) return "paused";
	return ok ? "up" : "down";
}

/** The incidents tab: this service's incidents, or the all-clear when it has none. */
function IncidentsTab(handle: Handle<{ service: Service }>) {
	return () => {
		let { service } = handle.props;
		let incidents = INCIDENTS.filter((incident) => incident.service === service.id);
		if (incidents.length === 0) {
			return (
				<Empty kind="cleared" size="compact">
					<Empty.Title>{COPY.service.noIncidents}</Empty.Title>
					<Empty.Description>{COPY.service.noIncidentsHint}</Empty.Description>
				</Empty>
			);
		}
		return (
			<Panel id="pulse-service-incidents" title={COPY.service.incidents} flush>
				<Table.Container>
					<Table aria-label={COPY.service.incidents} density="compact">
						<Table.Header>
							<Table.Row>
								<Table.Column>{COPY.incidents.columns.id}</Table.Column>
								<Table.Column>{COPY.incidents.columns.title}</Table.Column>
								<Table.Column>{COPY.incidents.columns.status}</Table.Column>
								<Table.Column>{COPY.incidents.columns.started}</Table.Column>
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{incidents.map((incident) => (
								<Table.Row key={incident.id}>
									<Table.Cell mix={[font("mono")]}>{incident.id}</Table.Cell>
									<Table.Cell>{incident.title}</Table.Cell>
									<Table.StatusCell color={INCIDENT_STATUS[incident.status].color}>
										{INCIDENT_STATUS[incident.status].label}
									</Table.StatusCell>
									<Table.DateCell date={incident.startedAt} now={NOW} locale={LOCALE} />
								</Table.Row>
							))}
						</Table.Body>
					</Table>
				</Table.Container>
			</Panel>
		);
	};
}

/** The settings tab: the check form with its own Save, and the delete behind a confirm. */
function SettingsTab(handle: Handle<{ service: Service }>) {
	return () => {
		let { service } = handle.props;
		let base = `services/${service.id}`;
		return (
			<div mix={[vstack({ gap: 6, align: "stretch" }), minIs(0)]}>
				<SettingsSection
					title={COPY.service.settingsTitle}
					description={COPY.service.settingsDescription}
					save="explicit"
					form={{ action: actionHref(`${base}/settings`) }}
					labels={{ save: COPY.service.save }}
				>
					<SettingsSection.Row label={COPY.service.nameLabel} htmlFor="pulse-service-name">
						<Input id="pulse-service-name" name="name" defaultValue={service.name} required />
					</SettingsSection.Row>
					<SettingsSection.Row label={COPY.service.intervalLabel} htmlFor="pulse-service-interval">
						<Select id="pulse-service-interval" name="interval">
							{Object.entries(COPY.service.intervals).map(([value, label]) => (
								<Select.Option
									key={value}
									value={value}
									selected={Number(value) === service.interval}
								>
									{label}
								</Select.Option>
							))}
						</Select>
					</SettingsSection.Row>
					<SettingsSection.Row
						label={COPY.service.timeoutLabel}
						description={COPY.service.timeoutHint}
						htmlFor="pulse-service-timeout"
					>
						<Input id="pulse-service-timeout" name="timeoutMs" type="number" defaultValue="10000" />
					</SettingsSection.Row>
				</SettingsSection>
				<DangerZone title={COPY.service.danger}>
					<DangerZone.Action
						id="pulse-service-delete"
						title={COPY.service.deleteTitle}
						description={COPY.service.deleteDescription}
						buttonLabel={COPY.service.deleteButton}
						confirm={{
							title: COPY.service.deleteConfirmTitle,
							description: COPY.service.deleteConfirmBody(service.name),
							confirmLabel: COPY.services.delete,
							cancelLabel: COPY.service.cancel,
							form: { action: actionHref(`${base}/delete`) },
						}}
					/>
				</DangerZone>
			</div>
		);
	};
}

/** A service's page content, under the frame. */
export default function ServicePage(handle: Handle<ServicePage.Props>) {
	return () => {
		let { request, service } = handle.props;
		let tab = pick(request.url, "tab", TABS, "overview");
		let base = `services/${service.id}`;
		let paused = service.status === "paused";
		let incidents = INCIDENTS.filter((incident) => incident.service === service.id).length;
		let tabHref = (id: ServiceTab) => href(id === "overview" ? base : `${base}?tab=${id}`);

		return (
			<div mix={[vstack({ gap: 5, align: "stretch" }), minIs(0)]}>
				<PageHeader
					title={<span mix={[font("mono")]}>{service.name}</span>}
					crumbs={[{ label: COPY.services.title, href: href("services") }, { label: service.name }]}
					crumbsLabel={COPY.service.crumbs}
					parent={{ href: href("services"), label: COPY.services.title }}
					description={
						<span mix={[text("sm"), fg("neutral.muted")]}>
							{COPY.sheet.description(service.kind, REGIONS[service.region])}
						</span>
					}
					status={
						<StatusDot color={STATUS[service.status].color}>
							{STATUS[service.status].label}
						</StatusDot>
					}
					actions={
						<>
							<form method="post" action={actionHref(`${base}/${paused ? "resume" : "pause"}`)}>
								<Button type="submit" size="sm" variant="outline" color="neutral">
									{paused ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
									{paused ? COPY.service.resume : COPY.service.pause}
								</Button>
							</form>
						</>
					}
					primaryAction={
						<form method="post" action={actionHref(`${base}/check`)}>
							<Button type="submit" size="sm" disabled={paused}>
								<RefreshCwIcon size={14} />
								{COPY.service.runCheck}
							</Button>
						</form>
					}
					tabs={TABS.map((id) => ({
						href: tabHref(id),
						label: COPY.service[id],
						count: id === "incidents" ? incidents : undefined,
						current: id === tab,
					}))}
					tabsLabel={COPY.service.tabs}
				/>
				<HeadingScope level={2}>
					{tab === "overview" ? <OverviewTab service={service} /> : null}
					{tab === "checks" ? <ChecksTab service={service} /> : null}
					{tab === "incidents" ? <IncidentsTab service={service} /> : null}
					{tab === "settings" ? <SettingsTab service={service} /> : null}
				</HeadingScope>
			</div>
		);
	};
}
