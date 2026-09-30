/**
 * The maintenance a public status page publishes, as a list for the page and as an
 * iCalendar feed or single-window download. Page, feed and download read the same windows
 * and the same events, so a subscriber's calendar and the page never disagree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ICalendar } from "@sdxc/icalendar";
import type { Database } from "remix/data-table";

import { DAY_MS } from "@sdxc/dates/zone";
import { occurrences } from "@sdxc/icalendar/rrule";
import { isSuccess } from "@sdxc/result";

import type { StatusPageService } from "~/app/data/maintenance-window";
import type { SelectMaintenanceWindow, SelectStatusPage } from "~/database/schema";

import CronJobMonitor from "~/app/data/cron-job";
import DnsMonitor from "~/app/data/dns-monitor";
import MaintenanceWindow, { oneOffEvent, recurringEvent } from "~/app/data/maintenance-window";
import Monitor from "~/app/data/monitor";
import StatusPage from "~/app/data/status-page";
import TcpMonitor from "~/app/data/tcp-monitor";
import { monitorScopeMatches, storedMonitorScope } from "~/app/lib/monitor-scope";

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
	db: Database,
	page: SelectStatusPage,
): Promise<NamedStatusPageService[]> {
	let [attachments, monitors, dnsMonitors, tcpMonitors, flows, cronJobs] = await Promise.all([
		StatusPage.listAttachments(db, page.id),
		Monitor.listByTeam(db, page.team_id),
		DnsMonitor.listByTeam(db, page.team_id),
		TcpMonitor.listByTeam(db, page.team_id),
		StatusPage.listPublicFlowMonitors(db, page.team_id),
		CronJobMonitor.listByTeam(db, page.team_id),
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
	db: Database,
	page: SelectStatusPage,
	services: NamedStatusPageService[],
	now: number,
): Promise<PublishedMaintenance[]> {
	let windows = await MaintenanceWindow.listForStatusPage(db, page.team_id, services, now);

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
