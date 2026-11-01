/**
 * Pulse's overview: is anything wrong, and where? Four stat tabs switch one chart, the range
 * picker drives it from the URL, the open incident and the collector outage are marked on it,
 * and a short table names the services that need attention.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { is, minIs } from "@sdxc/u/size";
import { font, nowrap, text } from "@sdxc/u/typography";
import { HeadingScope, LinkButton } from "@sdxc/ui";
import { Chart } from "@sdxc/ui/app/chart";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { RangePicker } from "@sdxc/ui/app/range-picker";
import { Skeleton } from "@sdxc/ui/app/skeleton";
import { Sparkline } from "@sdxc/ui/app/sparkline";
import { StatCard } from "@sdxc/ui/app/stat-card";
import { Table } from "@sdxc/ui/app/table";

import type { DemoAppRequest } from "~/resources/views/demo-apps";

import type { MetricId, MetricSeries, RangeId } from "./metrics";

import { href, LOCALE, NOW, SERVICES } from "./data";
import { COPY, INCIDENT_STATUS, RANGE_LABELS, STATUS, TREND } from "./labels";
import {
	DEFAULT_RANGE,
	METRIC_IDS,
	metricSeries,
	RANGE_IDS,
	sparklineDomain,
	SUMMARIES,
} from "./metrics";
import { COUNT, MILLISECONDS, Panel, PERCENT, StateLinks } from "./parts";

/** The chart's drawing box; the SVG scales to its column from this ratio. */
const CHART_SIZE = { width: 960, height: 260 } as const;

/** The region states a visitor can preview from the overview's footer. */
type OverviewState = "live" | "loading" | "error";

/**
 * Reads one of a fixed set of values from the query, falling back when the value is missing
 * or unknown, so a hand-edited address always renders a real screen.
 */
export function pick<Value extends string>(
	url: URL,
	name: string,
	values: readonly Value[],
	fallback: Value,
): Value {
	let value = url.searchParams.get(name);
	return values.find((candidate) => candidate === value) ?? fallback;
}

/** Writes a metric's headline value in the unit it is read in. */
function formatValue(metric: MetricId, value: number): string {
	if (metric === "latency") return MILLISECONDS.format(value);
	if (metric === "incidents") return COUNT.format(value);
	return PERCENT.format(value);
}

/** Writes a metric's change with its sign, in percentage points for the two shares. */
function formatChange(metric: MetricId, change: number): string {
	let sign = change > 0 ? "+" : "−";
	let magnitude = Math.abs(change);
	if (metric === "latency") return `${sign}${MILLISECONDS.format(magnitude)}`;
	if (metric === "incidents") return `${sign}${COUNT.format(magnitude)}`;
	return `${sign}${(magnitude * 100).toFixed(2)} pts`;
}

/** The sentence under each stat, which says what moved the number. */
const FOOTERS: Record<MetricId, string> = {
	uptime: "checkout-api has been down since 05:41.",
	latency: "payments-webhooks is 4× its usual p95.",
	errors: "41% of checkout requests fail.",
	incidents: "One SEV1, one SEV2 and one SEV3.",
};

namespace MetricChart {
	export interface Props {
		metric: MetricId;
		range: RangeId;
		series: MetricSeries;
	}
}

/**
 * The overview's chart: bars for incident counts, lines for the rates, each with the previous
 * period dashed behind it, the open incident shaded red and the outage hatched as unknown.
 */
function MetricChart(handle: Handle<MetricChart.Props>) {
	return () => {
		let { metric, range, series } = handle.props;
		let name = COPY.overview.metrics[metric];
		let rangeName = COPY.range.presets[range].long;
		let label = COPY.overview.chartLabel(name, rangeName);
		let last = series.current.length - 1;

		if (metric === "incidents") {
			return (
				<Chart.Bar
					width={CHART_SIZE.width}
					height={CHART_SIZE.height}
					domain={series.domain}
					aria-label={label}
					series={["current"]}
					data={series.current.map((value, index) => ({
						category: String(index),
						values: {
							current: {
								value,
								label: value === null ? COPY.overview.noData : `${name}: ${value}`,
							},
						},
					}))}
				/>
			);
		}

		return (
			<Chart
				width={CHART_SIZE.width}
				height={CHART_SIZE.height}
				xDomain={[0, last]}
				yDomain={series.domain}
				aria-label={label}
			>
				<Chart.Band
					from={series.gap[0] - 0.5}
					to={series.gap[1] + 0.5}
					label={COPY.overview.noData}
					variant="hatched"
				/>
				<Chart.Band
					from={series.incident[0] - 0.5}
					to={series.incident[1]}
					label={COPY.overview.incidentBand(
						series.incidentId,
						INCIDENT_STATUS[series.incidentStatus].label,
					)}
					tone="danger"
				/>
				<Chart.Line
					points={series.previous.map((y, x) => ({
						x,
						y,
						label: `${COPY.overview.legendPrevious}, bucket ${x + 1}: ${y}`,
					}))}
					comparison
				/>
				<Chart.Line
					points={series.current.map((y, x) => ({
						x,
						y,
						label:
							y === null
								? COPY.overview.noData
								: `${COPY.overview.legendCurrent}, bucket ${x + 1}: ${y}`,
					}))}
				/>
			</Chart>
		);
	};
}

namespace Overview {
	export interface Props {
		request: DemoAppRequest;
	}
}

/** The overview screen's content, under the frame. */
export default function Overview(handle: Handle<Overview.Props>) {
	return () => {
		let { url } = handle.props.request;
		let metric = pick(url, "metric", METRIC_IDS, "uptime");
		let range = pick(url, "range", RANGE_IDS, DEFAULT_RANGE);
		let state = pick<OverviewState>(url, "state", ["live", "loading", "error"], "live");
		let series = metricSeries(metric, range);
		let rangeName = COPY.range.presets[range].long;
		let attention = SERVICES.filter(
			(service) => service.status === "down" || service.status === "degraded",
		);
		let query = (next: Record<string, string>) => {
			let params = new URLSearchParams({ metric, range, ...next });
			if (params.get("metric") === "uptime") params.delete("metric");
			if (params.get("range") === DEFAULT_RANGE) params.delete("range");
			if (params.get("state") === "live") params.delete("state");
			let search = params.toString();
			return href(search === "" ? "" : `?${search}`);
		};

		return (
			<div mix={[vstack({ gap: 5, align: "stretch" }), minIs(0)]}>
				<PageHeader
					title={COPY.overview.title}
					description={COPY.overview.description}
					actions={
						<RangePicker
							value={range}
							action={href()}
							params={metric === "uptime" ? {} : { metric }}
							presets={RANGE_IDS.map((id) => ({
								value: id,
								label: COPY.range.presets[id].label,
								description: COPY.range.presets[id].description,
							}))}
							labels={RANGE_LABELS}
						/>
					}
				/>
				<HeadingScope level={2}>
					{state === "loading" ? (
						<StatCard.Group variant="tabs" columns={4} aria-label={COPY.overview.loadingStats}>
							{METRIC_IDS.map((id) => (
								<StatCard.Skeleton key={id} delta footer />
							))}
						</StatCard.Group>
					) : (
						<StatCard.Group variant="tabs" columns={4} aria-label={COPY.overview.tabs}>
							{METRIC_IDS.map((id) => {
								let summary = SUMMARIES[id];
								return (
									<StatCard key={id} href={query({ metric: id })} current={id === metric}>
										<StatCard.Label>{COPY.overview.metrics[id]}</StatCard.Label>
										<StatCard.Value mix={[font("mono")]}>
											{formatValue(id, summary.value)}
										</StatCard.Value>
										<StatCard.Delta
											trend={summary.trend}
											invert={summary.invert}
											comparison={COPY.overview.comparison(rangeName)}
										>
											{formatChange(id, summary.change)}
										</StatCard.Delta>
										<StatCard.Footer>{FOOTERS[id]}</StatCard.Footer>
									</StatCard>
								);
							})}
						</StatCard.Group>
					)}

					<Panel
						id="pulse-chart"
						title={COPY.overview.chartLabel(COPY.overview.metrics[metric], rangeName)}
						description={COPY.overview.legend}
					>
						{state === "loading" ? (
							<div
								role="status"
								aria-label={COPY.overview.loadingStats}
								mix={[
									is("100%"),
									raw({
										aspectRatio: `${CHART_SIZE.width} / ${CHART_SIZE.height}`,
										borderRadius: "var(--ui-radius-md)",
										background: "var(--ui-neutral-bg-tint)",
									}),
								]}
							/>
						) : (
							<div mix={[vstack({ gap: 2, align: "stretch" })]}>
								<MetricChart metric={metric} range={range} series={series} />
								<div
									mix={[
										hstack({ gap: 3, justify: "between" }),
										text("xs"),
										font("mono"),
										fg("neutral.muted"),
									]}
								>
									<span>{COPY.overview.chartStart(rangeName)}</span>
									<span>{COPY.overview.chartEnd}</span>
								</div>
							</div>
						)}
					</Panel>

					<Panel
						id="pulse-attention"
						title={COPY.overview.attention}
						description={COPY.overview.attentionDescription}
						actions={
							<LinkButton
								href={href("services?status=down&status=degraded")}
								size="sm"
								variant="ghost"
							>
								{COPY.overview.viewAll}
							</LinkButton>
						}
						flush
					>
						<Table.Container>
							<Table aria-label={COPY.overview.attention} density="compact">
								<Table.Header>
									<Table.Row>
										<Table.Column>{COPY.services.columns.name}</Table.Column>
										<Table.Column>{COPY.services.columns.status}</Table.Column>
										<Table.Column numeric>{COPY.services.columns.latency}</Table.Column>
										<Table.Column>{COPY.services.columns.trend}</Table.Column>
										<Table.Column>{COPY.services.columns.checked}</Table.Column>
									</Table.Row>
								</Table.Header>
								{state === "loading" ? (
									<Skeleton.Table
										rows={attention.length}
										columns={5}
										label={COPY.overview.loading}
									/>
								) : null}
								{state === "error" ? (
									<Table.Error
										colSpan={5}
										action={
											<LinkButton
												href={query({ state: "live" })}
												size="sm"
												variant="outline"
												color="neutral"
											>
												{COPY.overview.retry}
											</LinkButton>
										}
									>
										{COPY.overview.failed}. {COPY.overview.failedHint}
									</Table.Error>
								) : null}
								{state === "live" ? (
									<Table.Body>
										{attention.map((service) => (
											<Table.Row key={service.id}>
												<Table.Cell>
													<Table.RowLink href={href(`services/${service.id}`)} mix={[font("mono")]}>
														{service.name}
													</Table.RowLink>
												</Table.Cell>
												<Table.StatusCell color={STATUS[service.status].color}>
													{STATUS[service.status].label}
												</Table.StatusCell>
												<Table.NumberCell
													value={service.latencyMs}
													locale={LOCALE}
													format={{ style: "unit", unit: "millisecond" }}
													mix={[font("mono"), nowrap()]}
												/>
												<Table.Cell>
													<Sparkline
														values={service.latency}
														domain={sparklineDomain(service.latency)}
														label={COPY.services.trendLabel(
															service.name,
															TREND[service.trend].label,
														)}
														tone={TREND[service.trend].tone}
														state={TREND[service.trend].label}
													/>
												</Table.Cell>
												<Table.DateCell date={service.checkedAt} now={NOW} locale={LOCALE} />
											</Table.Row>
										))}
									</Table.Body>
								) : null}
							</Table>
						</Table.Container>
					</Panel>
				</HeadingScope>

				<div mix={[hstack({ gap: 3 }), flexWrap("wrap")]}>
					<StateLinks
						label={COPY.overview.states}
						links={(["live", "loading", "error"] as const).map((id) => ({
							href: query({ state: id }),
							label: COPY.overview[`${id}State`],
							current: id === state,
						}))}
					/>
				</div>
			</div>
		);
	};
}
