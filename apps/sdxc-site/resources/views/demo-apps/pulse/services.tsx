/**
 * Pulse's services list: a query you can read. Tabs, facets with counts, search and sort live
 * in the URL and really filter the fixtures; density is a display choice; selecting rows turns
 * the footer into the bulk bar; Space or `?peek=` opens a service beside the list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { PauseIcon, PlayIcon, TrashIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { minIs } from "@sdxc/u/size";
import { HeadingScope, LinkButton, StatusDot } from "@sdxc/ui";
import { clearFiltersHref, paramValues, setParamHref } from "@sdxc/ui/app";
import { AutoRefresh } from "@sdxc/ui/app/auto-refresh";
import { DetailSheet } from "@sdxc/ui/app/detail-sheet";
import { Empty } from "@sdxc/ui/app/empty";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { SelectionBar } from "@sdxc/ui/app/selection-bar";
import { Skeleton } from "@sdxc/ui/app/skeleton";
import { Table } from "@sdxc/ui/app/table";
import { ViewOptions } from "@sdxc/ui/app/view-options";

import type { DemoAppRequest } from "~/resources/views/demo-apps";

import DemoAppFrame from "~/resources/views/demo-apps/frame";

import type { RegionId, Service, ServiceStatus } from "./data";
import type { ServiceRow, SortLink } from "./services-table";

import {
	actionHref,
	href,
	LOCALE,
	NOW,
	REGIONS,
	SERVICES,
	uptimeDays,
	uptimeRatio,
	withoutToast,
} from "./data";
import {
	COPY,
	DENSITY,
	FILTER_LABELS,
	SELECTION_LABELS,
	SHEET_LABELS,
	STATUS,
	TREND,
	VIEW_LABELS,
} from "./labels";
import { pick } from "./overview";
import { PERCENT, StateLinks } from "./parts";
import { PeekPlaceholder } from "./service-parts";
import { ServicesTable } from "./services-table";

/**
 * Days of history each list row draws. Twelve rows of ninety bars weighed most of the page,
 * so the list shows the last month and a service's own page shows all ninety days.
 */
const LIST_DAYS = 30;

/** The tabs over the list, each a saved slice of it. */
type Show = "all" | "failing" | "paused";

/** The orders the list can be sorted in. */
type SortId = "name" | "status" | "latency" | "checked";

/** Every parameter the toolbar's filters own, which "Clear filters" drops. */
const FILTER_PARAMS = ["status", "region", "q"] as const;

/** The id the bulk form, the checkboxes and the selection bar share. */
const BULK_FORM = "pulse-bulk";

/** How severe each status is, so "Status" sorts the worst first. */
const SEVERITY: Record<ServiceStatus, number> = { down: 0, degraded: 1, up: 2, paused: 3 };

/** The list's state as the address holds it. */
export interface ServiceQuery {
	show: Show;
	status: ServiceStatus[];
	region: RegionId[];
	q: string;
	sort: SortId;
}

/**
 * Reads the list's state from the address, ignoring any value the toolbar never offers, so a
 * hand-edited link still renders a real view.
 *
 * @param url The request's address.
 * @returns The tab, filters, search and sort the list applies.
 */
export function readServiceQuery(url: URL): ServiceQuery {
	let statuses = Object.keys(STATUS) as ServiceStatus[];
	let regions = Object.keys(REGIONS) as RegionId[];
	return {
		show: pick<Show>(url, "show", ["all", "failing", "paused"], "all"),
		status: paramValues(url, "status").filter((value): value is ServiceStatus =>
			statuses.includes(value as ServiceStatus),
		),
		region: paramValues(url, "region").filter((value): value is RegionId =>
			regions.includes(value as RegionId),
		),
		q: (url.searchParams.get("q") ?? "").trim().toLowerCase(),
		sort: pick<SortId>(url, "sort", ["name", "status", "latency", "checked"], "name"),
	};
}

/**
 * Whether a service passes the query, leaving out one part of it so a facet can count what
 * picking each of its own values would show.
 */
function matches(service: Service, query: ServiceQuery, skip?: "show" | "status" | "region") {
	if (skip !== "show") {
		if (query.show === "failing" && service.status !== "down" && service.status !== "degraded") {
			return false;
		}
		if (query.show === "paused" && service.status !== "paused") return false;
	}
	if (skip !== "status" && query.status.length > 0 && !query.status.includes(service.status)) {
		return false;
	}
	if (skip !== "region" && query.region.length > 0 && !query.region.includes(service.region)) {
		return false;
	}
	if (query.q !== "") {
		let haystack = `${service.name} ${service.kind} ${service.owner}`.toLowerCase();
		if (!haystack.includes(query.q)) return false;
	}
	return true;
}

/**
 * The services the query shows, in its order: by name, worst status first, slowest first
 * (unknown latency last), or most recently checked.
 *
 * @param query The list's state.
 * @returns The matching services, sorted.
 */
export function filterServices(query: ServiceQuery): Service[] {
	let rows = SERVICES.filter((service) => matches(service, query));
	let compare: Record<SortId, (a: Service, b: Service) => number> = {
		name: (a, b) => a.name.localeCompare(b.name),
		status: (a, b) => SEVERITY[a.status] - SEVERITY[b.status] || a.name.localeCompare(b.name),
		latency: (a, b) => (b.latencyMs ?? -1) - (a.latencyMs ?? -1),
		checked: (a, b) => b.checkedAt.localeCompare(a.checkedAt),
	};
	return rows.sort(compare[query.sort]);
}

/** One sortable header's link, with its direction while the list is sorted by it. */
function sortLink(url: URL, query: ServiceQuery, id: SortId): SortLink {
	let direction: SortLink["direction"] = id === "name" ? "ascending" : "descending";
	return {
		href: setParamHref(url, "sort", id === "name" ? null : id),
		direction: query.sort === id ? direction : undefined,
	};
}

/**
 * The list view a row or bulk action returns to: this page with its filters, without the
 * toast or the open sheet, so the redirect lands on the same query.
 */
function listPage(url: URL): string {
	let params = new URLSearchParams(url.searchParams);
	params.delete("toast");
	params.delete("peek");
	let search = params.toString();
	return search === "" ? "services" : `services?${search}`;
}

/** Writes one service as the island draws it. */
function toRow(service: Service, url: URL, peeked: boolean): ServiceRow {
	let uptime = uptimeRatio(service, LIST_DAYS);
	let trend = TREND[service.trend];
	return {
		id: service.id,
		name: service.name,
		href: href(`services/${service.id}`),
		peekHref: setParamHref(url, "peek", service.id),
		editHref: href(`services/${service.id}?tab=settings`),
		toggleAction: actionHref(
			`services/${service.id}/${service.status === "paused" ? "resume" : "pause"}`,
		),
		deleteAction: actionHref(`services/${service.id}/delete`),
		paused: service.status === "paused",
		status: STATUS[service.status],
		latencyMs: service.latencyMs,
		latency: [...service.latency],
		trend: {
			label: trend.label,
			tone: trend.tone,
			aria: COPY.services.trendLabel(service.name, trend.label),
		},
		periods: uptimeDays(service, COPY.services.dayLabel, LIST_DAYS),
		stripLabel: COPY.services.stripLabel(service.name, LIST_DAYS),
		stripSummary: COPY.services.stripSummary(uptime === null ? "—" : PERCENT.format(uptime)),
		checkedAt: service.checkedAt,
		selectLabel: COPY.services.select(service.name),
		peeked,
		next: listPage(url),
	};
}

/** The region states a visitor can preview under the list. */
type ListState = "live" | "loading" | "error";

namespace Services {
	export interface Props {
		request: DemoAppRequest;
	}
}

/** The services list screen's content, under the frame. */
export default function Services(handle: Handle<Services.Props>) {
	return () => {
		let url = withoutToast(handle.props.request.url);
		let query = readServiceQuery(url);
		let state = pick<ListState>(url, "state", ["live", "loading", "error"], "live");
		let density = pick(url, "density", ["compact", "comfortable"], "compact");
		let rows = filterServices(query);
		let peekId = url.searchParams.get("peek");
		let peekIndex = rows.findIndex((service) => service.id === peekId);
		let peeked = peekIndex === -1 ? undefined : rows[peekIndex];
		let without = (skip: "show" | "status" | "region") =>
			SERVICES.filter((service) => matches(service, query, skip));
		let tabHref = (show: Show) => setParamHref(url, "show", show === "all" ? null : show);
		let refresh = Number(url.searchParams.get("refresh") ?? "30");
		let autoRefresh = {
			id: "pulse-services-refresh",
			url,
			value: Number.isFinite(refresh) ? refresh : 30,
			defaultValue: 30,
			options: [
				{ value: 0, label: COPY.refresh.off },
				{ value: 30, label: COPY.refresh.every(30) },
				{ value: 60, label: COPY.refresh.every(60) },
			],
			refreshedAt: new Date(NOW),
			locale: LOCALE,
			labels: { trigger: COPY.refresh.trigger, updated: COPY.refresh.updated },
		};

		return (
			<div mix={[vstack({ gap: 4, align: "stretch" }), minIs(0)]}>
				<PageHeader title={COPY.services.title} description={COPY.services.description} />
				<HeadingScope level={2}>
					<FilterBar
						prefetch="intent"
						id="pulse-services"
						url={url}
						locale={LOCALE}
						tabs={[
							{
								label: COPY.services.all,
								count: without("show").length,
								href: tabHref("all"),
								current: query.show === "all",
							},
							{
								label: COPY.services.failing,
								count: without("show").filter((s) => s.status === "down" || s.status === "degraded")
									.length,
								href: tabHref("failing"),
								current: query.show === "failing",
							},
							{
								label: STATUS.paused.label,
								count: without("show").filter((s) => s.status === "paused").length,
								href: tabHref("paused"),
								current: query.show === "paused",
							},
						]}
						facets={[
							{
								name: "status",
								label: COPY.filters.status,
								options: (Object.keys(STATUS) as ServiceStatus[]).map((status) => ({
									value: status,
									label: STATUS[status].label,
									count: without("status").filter((s) => s.status === status).length,
									icon: <StatusDot color={STATUS[status].color} />,
								})),
							},
							{
								name: "region",
								label: COPY.filters.region,
								options: (Object.keys(REGIONS) as RegionId[]).map((region) => ({
									value: region,
									label: REGIONS[region],
									count: without("region").filter((s) => s.region === region).length,
								})),
							},
						]}
						search={{ label: COPY.filters.search, placeholder: COPY.filters.searchPlaceholder }}
						sort={{
							label: COPY.filters.sort,
							defaultValue: "name",
							options: (["name", "status", "latency", "checked"] as const).map((id) => ({
								value: id,
								label: COPY.filters.sortOptions[id],
							})),
						}}
						options={
							<>
								<ViewOptions
									id="pulse-services-view"
									url={url}
									inline
									density={{
										defaultValue: "compact",
										options: [
											{ value: "compact", label: DENSITY.compact },
											{ value: "comfortable", label: DENSITY.comfortable },
										],
									}}
									labels={VIEW_LABELS}
								/>
								<AutoRefresh {...autoRefresh} show="choices" />
							</>
						}
						status={<AutoRefresh {...autoRefresh} show="status" />}
						collapse
						labels={FILTER_LABELS}
					/>

					<form id={BULK_FORM} method="post" action={actionHref("services")} hidden>
						<input type="hidden" name="next" value={listPage(url)} />
					</form>

					<div id="pulse-services-rows">
						{state === "live" && rows.length > 0 ? (
							<ServicesTable
								rows={rows.map((service) => toRow(service, url, service.id === peeked?.id))}
								density={density}
								form={BULK_FORM}
								now={NOW}
								locale={LOCALE}
								sort={{
									name: sortLink(url, query, "name"),
									status: sortLink(url, query, "status"),
									latency: sortLink(url, query, "latency"),
									checked: sortLink(url, query, "checked"),
								}}
								labels={{
									table: COPY.services.table,
									selectAll: COPY.services.selectAll,
									columns: COPY.services.columns,
									pause: COPY.services.pause,
									resume: COPY.services.resume,
									edit: COPY.services.edit,
									delete: COPY.services.delete,
									keys: COPY.services.keys,
								}}
							/>
						) : null}
						{state === "live" && rows.length === 0 ? (
							<Empty kind="no-results" size="compact">
								<Empty.Title>{COPY.services.noResults}</Empty.Title>
								{query.q === "" ? null : <Empty.Query>{query.q}</Empty.Query>}
								<Empty.Description>{COPY.services.noResultsHint}</Empty.Description>
								<Empty.Action>
									<LinkButton
										href={clearFiltersHref(clearFiltersHref(url, FILTER_PARAMS), ["show"])}
										size="sm"
										variant="outline"
										color="neutral"
									>
										{COPY.services.clear}
									</LinkButton>
								</Empty.Action>
							</Empty>
						) : null}
						{state === "live" ? null : (
							<Table.Container>
								<Table aria-label={COPY.services.table} density={density}>
									<Table.Header>
										<Table.Row>
											<Table.Column>{COPY.services.columns.name}</Table.Column>
											<Table.Column>{COPY.services.columns.status}</Table.Column>
											<Table.Column numeric>{COPY.services.columns.latency}</Table.Column>
											<Table.Column>{COPY.services.columns.trend}</Table.Column>
											<Table.Column>{COPY.services.columns.uptime}</Table.Column>
											<Table.Column>{COPY.services.columns.checked}</Table.Column>
										</Table.Row>
									</Table.Header>
									{state === "loading" ? (
										<Skeleton.Table rows={8} columns={6} label={COPY.services.loading} />
									) : (
										<Table.Error
											colSpan={6}
											action={
												<LinkButton
													href={setParamHref(url, "state", null)}
													size="sm"
													variant="outline"
													color="neutral"
												>
													{COPY.services.retry}
												</LinkButton>
											}
										>
											{COPY.services.failed}
										</Table.Error>
									)}
								</Table>
							</Table.Container>
						)}
					</div>

					<SelectionBar
						target="pulse-services-rows"
						form={BULK_FORM}
						locale={LOCALE}
						pagination={{ summary: COPY.services.viewing(rows.length, SERVICES.length) }}
						actions={[
							{
								label: COPY.services.pause,
								key: "p",
								icon: <PauseIcon size={16} />,
								name: "intent",
								value: "pause",
							},
							{
								label: COPY.services.resume,
								key: "r",
								icon: <PlayIcon size={16} />,
								name: "intent",
								value: "resume",
							},
							{
								label: COPY.services.delete,
								key: "d",
								icon: <TrashIcon size={16} />,
								name: "intent",
								value: "delete",
								danger: true,
							},
						]}
						labels={SELECTION_LABELS}
					/>

					<StateLinks
						label={COPY.overview.states}
						links={(["live", "loading", "error"] as const).map((id) => ({
							href: setParamHref(url, "state", id === "live" ? null : id),
							label: COPY.overview[`${id}State`],
							current: id === state,
						}))}
					/>

					{peeked === undefined ? null : (
						<DetailSheet
							id="pulse-peek"
							title={peeked.name}
							description={COPY.sheet.description(peeked.kind, REGIONS[peeked.region])}
							closeHref={setParamHref(url, "peek", null)}
							permalink={href(`services/${peeked.id}`)}
							position={{
								index: peekIndex + 1,
								total: rows.length,
								previousHref:
									peekIndex > 0 ? setParamHref(url, "peek", rows[peekIndex - 1]!.id) : null,
								nextHref:
									peekIndex < rows.length - 1
										? setParamHref(url, "peek", rows[peekIndex + 1]!.id)
										: null,
							}}
							footer={
								<LinkButton href={href(`services/${peeked.id}`)} size="sm">
									{COPY.sheet.open}
								</LinkButton>
							}
							labels={SHEET_LABELS}
							keys="sheet"
						>
							<DemoAppFrame
								app="pulse"
								part={`services/${peeked.id}/peek`}
								fallback={<PeekPlaceholder service={peeked} />}
							/>
						</DetailSheet>
					)}
				</HeadingScope>
			</div>
		);
	};
}
