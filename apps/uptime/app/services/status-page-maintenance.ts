/**
 * The maintenance a public status page publishes, as a list for the page and as a feed or
 * single-window download in iCalendar or JSCalendar. Every representation reads the same
 * windows and the same events, so a subscriber's calendar and the page never disagree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { I18n } from "@sdxc/i18n";
import type { ICalendar } from "@sdxc/icalendar";

import { DAY_MS } from "@sdxc/dates/zone";
import { accepts } from "@sdxc/http/negotiate";
import { calendarResponse, MEDIA_TYPE as ICALENDAR_MEDIA_TYPE } from "@sdxc/icalendar";
import { occurrences } from "@sdxc/icalendar/rrule";
import { jscalendarResponse, MEDIA_TYPE as JSCALENDAR_MEDIA_TYPE } from "@sdxc/jscalendar";
import { fromICalendar } from "@sdxc/jscalendar/icalendar";
import { serializeLink } from "@sdxc/link-header";
import { isSuccess } from "@sdxc/result";

import type { UptimeModels } from "~/app/models";
import type { StatusPageService } from "~/app/models/maintenance-windows";
import type { SelectMaintenanceWindow, SelectStatusPage } from "~/database/schema";

import { oneOffEvent, recurringEvent } from "~/app/models/maintenance-windows";
import { apportionCostByTeam } from "~/app/services/cost";
import { monitorScopeMatches, storedMonitorScope } from "~/app/services/monitor-scope";
import routes from "~/routes/web";

/** The `PRODID` of every calendar the status pages publish. */
const PRODUCT_ID = "-//sergiodxa//uptime//EN";

/** How far ahead the page looks for a recurring window's next occurrence. */
const LOOKAHEAD_MS = 62 * DAY_MS;

/** A service on a status page, under the name the page shows it by. */
export interface NamedStatusPageService extends StatusPageService {
	name: string;
}

/** One published window, the services it affects, and its next or current occurrence. */
export interface PublishedMaintenance {
	window: SelectMaintenanceWindow;
	affected: string[];
	/** The occurrence running now or next, `null` when nothing is left to happen. */
	next: { start: number; end: number } | null;
}

/** The copy a calendar carries, translated by the caller. */
export interface CalendarCopy {
	name: string;
	describe(affected: string[]): string | undefined;
}

/**
 * The label a service is published under: the team's public name when set, the monitor's
 * internal name otherwise, so a cleared display name still leaves the row named.
 */
export function publicName(displayName: string | null, fallback: string): string {
	return displayName?.trim() || fallback;
}

/** Every service a page shows, named the way the page names it, in the page's order. */
export async function listPageServices(
	models: UptimeModels,
	page: SelectStatusPage,
): Promise<NamedStatusPageService[]> {
	let [attachments, monitors, dnsMonitors, tcpMonitors, flows, cronJobs] = await Promise.all([
		models.statusPages.listAttachments(page.id),
		models.monitors.inTeam(page.team_id).orderBy("created_at", "desc").all(),
		models.dnsMonitors.inTeam(page.team_id).orderBy("created_at", "desc").all(),
		models.tcpMonitors.inTeam(page.team_id).orderBy("created_at", "desc").all(),
		models.statusPages.listPublicFlowMonitors(page.team_id),
		models.cronJobMonitors.inTeam(page.team_id).orderBy("created_at", "desc").all(),
	]);

	let names = new Map<string, string>([
		...monitors.map((row) => [`http:${row.id}`, row.name] as const),
		...dnsMonitors.map((row) => [`dns:${row.id}`, row.name] as const),
		...tcpMonitors.map((row) => [`tcp:${row.id}`, row.name] as const),
		...flows.map((row) => [`flow:${row.id}`, row.name] as const),
		...cronJobs.map((row) => [`cron:${row.id}`, row.name] as const),
	]);

	let rows: { service: StatusPageService; displayName: string | null }[] = [
		...attachments.monitors.map((row) => ({
			service: { type: "http" as const, id: row.monitor_id },
			displayName: row.display_name,
		})),
		...attachments.dnsMonitors.map((row) => ({
			service: { type: "dns" as const, id: row.dns_monitor_id },
			displayName: row.display_name,
		})),
		...attachments.tcpMonitors.map((row) => ({
			service: { type: "tcp" as const, id: row.tcp_monitor_id },
			displayName: row.display_name,
		})),
		...attachments.flowMonitors.map((row) => ({
			service: { type: "flow" as const, id: row.flow_monitor_id },
			displayName: row.display_name,
		})),
		...attachments.cronJobs.map((row) => ({
			service: { type: "cron" as const, id: row.cron_job_monitor_id },
			displayName: row.display_name,
		})),
	];

	return rows.flatMap(({ service, displayName }) => {
		let name = names.get(`${service.type}:${service.id}`);
		return name === undefined ? [] : [{ ...service, name: publicName(displayName, name) }];
	});
}

/**
 * The windows a page publishes, each with the page's services it affects and the
 * occurrence running now or next. A team-wide window affects every service on the page.
 */
export async function listPublishedMaintenance(
	models: UptimeModels,
	page: SelectStatusPage,
	services: NamedStatusPageService[],
	now: number,
): Promise<PublishedMaintenance[]> {
	let windows = await models.maintenanceWindows.listForStatusPage(page.team_id, services, now);

	return windows.map((window) => {
		let scope = storedMonitorScope(window);
		let affected = services
			.filter((service) => monitorScopeMatches(scope, service.type, service.id))
			.map((service) => service.name);
		return { window, affected, next: nextOccurrence(window, now) };
	});
}

/** The occurrence of a window running at `now` or starting soonest after it. */
function nextOccurrence(
	window: SelectMaintenanceWindow,
	now: number,
): { start: number; end: number } | null {
	let candidates: { start: number; end: number }[] = [];

	let end = window.ended_early_at ?? window.ends_at;
	if (end > now) candidates.push({ start: window.starts_at, end });

	let event = recurringEvent(window);
	if (event) {
		let found = occurrences(event, { from: now, to: now + LOOKAHEAD_MS, limit: 1 });
		if (isSuccess(found) && found.data[0]) candidates.push(found.data[0]);
	}

	return candidates.sort((a, b) => a.start - b.start)[0] ?? null;
}

/** The events one published window stands for: its range, and its recurrence when it has one. */
export function maintenanceEvents(
	entry: PublishedMaintenance,
	copy: CalendarCopy,
	url: string,
): ICalendar.Event[] {
	let description = copy.describe(entry.affected);
	let events = [oneOffEvent(entry.window)];
	let recurring = recurringEvent(entry.window);
	if (recurring) events.push(recurring);

	return events.map((event) => ({ ...event, url, ...(description ? { description } : {}) }));
}

/**
 * A status page's maintenance as a subscribable calendar. Clients are asked to refresh
 * hourly, the least a moved or ended-early window should wait to reach a subscriber.
 */
export function maintenanceCalendar(
	entries: PublishedMaintenance[],
	copy: CalendarCopy,
	url: string,
): ICalendar.Calendar {
	return {
		productId: PRODUCT_ID,
		name: copy.name,
		url,
		refreshInterval: { hours: 1 },
		timeZones: [],
		events: entries.flatMap((entry) => maintenanceEvents(entry, copy, url)),
		components: [],
		properties: [],
	};
}

/** The formats a maintenance calendar is published in. */
export type CalendarFormat = "icalendar" | "jscalendar";

/** A page's published maintenance calendar, and the URLs it is served at in each format. */
export interface PublishedCalendar {
	calendar: ICalendar.Calendar;
	locations: Record<CalendarFormat, string>;
}

/** What `loadMaintenanceCalendar` reads from the request context. */
export interface CalendarContext {
	models: UptimeModels;
	intl: I18n;
	url: URL;
}

/**
 * The maintenance calendar of a public page, built once for every format: the whole feed,
 * or one window when `windowId` is set. A private or unknown page, and a window the page
 * does not publish, give `null`, which callers answer as a 404.
 */
export async function loadMaintenanceCalendar(
	ctx: CalendarContext,
	slug: string,
	windowId?: string,
): Promise<PublishedCalendar | null> {
	let page = await ctx.models.statusPages.findPublic(slug);
	if (!page) return null;

	apportionCostByTeam([page.team_id]);

	let services = await listPageServices(ctx.models, page);
	let entries = await listPublishedMaintenance(ctx.models, page, services, Date.now());
	if (windowId !== undefined) {
		entries = entries.filter((entry) => entry.window.id === windowId);
		if (entries.length === 0) return null;
	}

	let pageUrl = new URL(routes.statusPage.href({ slug }), ctx.url).toString();
	let calendar = maintenanceCalendar(
		entries,
		{
			name: ctx.intl.t("statusPage.maintenance.calendarName", { title: page.title }),
			describe: (affected) =>
				affected.length > 0
					? ctx.intl.t("statusPage.maintenance.affects", { services: affected.join(", ") })
					: undefined,
		},
		pageUrl,
	);

	let absolute = (path: string) => new URL(path, ctx.url).toString();
	let locations =
		windowId === undefined
			? {
					icalendar: absolute(routes.statusPageCalendar.href({ slug })),
					jscalendar: absolute(routes.statusPageCalendarJson.href({ slug })),
				}
			: {
					icalendar: absolute(routes.statusPageMaintenanceEvent.href({ slug, windowId })),
					jscalendar: absolute(routes.statusPageMaintenanceEventJson.href({ slug, windowId })),
				};
	return { calendar, locations };
}

/**
 * The format a request to an `.ics` URL gets: JSCalendar only when `Accept` ranks it above
 * `text/calendar`, so calendar clients and browsers accepting anything keep getting iCalendar.
 */
export function negotiateCalendarFormat(request: Request): CalendarFormat {
	let preferred = accepts(request).preferred(ICALENDAR_MEDIA_TYPE, JSCALENDAR_MEDIA_TYPE);
	return preferred === JSCALENDAR_MEDIA_TYPE ? "jscalendar" : "icalendar";
}

/**
 * A published calendar in one format, with a `Link: rel="alternate"` header naming the
 * other format's URL and media type. `download` names an attachment, its extension
 * following the format.
 */
export function calendarRepresentation(
	published: PublishedCalendar,
	format: CalendarFormat,
	init: { headers?: Headers; download?: string } = {},
): Response {
	let headers = new Headers(init.headers);
	let other: CalendarFormat = format === "icalendar" ? "jscalendar" : "icalendar";
	let otherType = other === "icalendar" ? ICALENDAR_MEDIA_TYPE : JSCALENDAR_MEDIA_TYPE;
	headers.append(
		"Link",
		serializeLink(published.locations[other], "alternate", { type: otherType }),
	);

	if (format === "icalendar") {
		let filename = init.download === undefined ? undefined : `${init.download}.ics`;
		return calendarResponse(published.calendar, { headers, ...(filename ? { filename } : {}) });
	}
	if (init.download !== undefined) {
		headers.set("Content-Disposition", `attachment; filename="${init.download}.json"`);
	}
	return jscalendarResponse(fromICalendar(published.calendar), { headers });
}
