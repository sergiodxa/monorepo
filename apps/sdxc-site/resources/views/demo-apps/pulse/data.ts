/**
 * Pulse's fixtures: the services, regions, incidents and deploys of Northwind, the invented
 * company the dashboard watches, with the series every chart and strip draws, all read
 * against one fixed request time so every render says the same thing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { StatusStrip } from "@sdxc/ui/app";

import { demoAppActionHref, demoAppHref } from "~/resources/views/demo-apps";

/** The addresses of Pulse's screens. */
export const href = demoAppHref("pulse");

/** The addresses Pulse's forms post to. */
export const actionHref = demoAppActionHref("pulse");

/** The request time every relative time reads against, so a render never drifts. */
export const NOW = "2026-11-01T12:00:00Z";

/** The locale every number and date is written in. */
export const LOCALE = "en-US";

/** A service's state, one word and one tone everywhere it shows. */
export type ServiceStatus = "up" | "degraded" | "down" | "paused";

/** What a service's recent latency is doing, read by its sparkline's state word. */
export type ServiceTrend = "stable" | "degrading" | "recovering" | "down" | "paused";

/** Where a service's checks run from. */
export type RegionId = "fra" | "iad" | "sin" | "gru";

/** One watched service. */
export interface Service {
	id: string;
	name: string;
	/** What runs behind the endpoint, as the team names it. */
	kind: string;
	endpoint: string;
	region: RegionId;
	status: ServiceStatus;
	trend: ServiceTrend;
	/** Latest p95 in milliseconds; `null` while down or paused. */
	latencyMs: number | null;
	/** Share of failed requests over the last hour; `null` while paused. */
	errorRate: number | null;
	/** Hourly p95 over the last 16 hours, `null` where no check answered. */
	latency: readonly (number | null)[];
	checkedAt: string;
	owner: string;
	version: string;
	/** Seconds between checks. */
	interval: number;
	/** Days since the service was first checked, which hatches the strip before it. */
	age: number;
	/** Days ago an outage hit, each drawn red on the 90-day strip. */
	outages: readonly number[];
	/** Days ago the service ran slow, each drawn amber on the strip. */
	slowDays: readonly number[];
}

/** Regions by id, in the order the facet lists them. */
export const REGIONS: Record<RegionId, string> = {
	fra: "Frankfurt",
	iad: "N. Virginia",
	sin: "Singapore",
	gru: "São Paulo",
};

/** Every service Northwind watches, in the order the list shows by default. */
export const SERVICES: readonly Service[] = [
	{
		id: "checkout-api",
		name: "checkout-api",
		kind: "HTTP API",
		endpoint: "https://api.northwind.dev/checkout/health",
		region: "iad",
		status: "down",
		trend: "down",
		latencyMs: null,
		errorRate: 0.412,
		latency: [
			182,
			176,
			190,
			188,
			201,
			240,
			342,
			518,
			940,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
		],
		checkedAt: "2026-11-01T11:59:40Z",
		owner: "Payments",
		version: "v4.18.2",
		interval: 30,
		age: 400,
		outages: [0, 23],
		slowDays: [1, 9, 40],
	},
	{
		id: "payments-webhooks",
		name: "payments-webhooks",
		kind: "Worker",
		endpoint: "https://hooks.northwind.dev/stripe",
		region: "fra",
		status: "degraded",
		trend: "degrading",
		latencyMs: 912,
		errorRate: 0.034,
		latency: [210, 205, 214, 222, 230, 260, 310, 402, 520, 610, 702, 760, 801, 850, 880, 912],
		checkedAt: "2026-11-01T11:59:10Z",
		owner: "Payments",
		version: "v2.7.0",
		interval: 60,
		age: 300,
		outages: [61],
		slowDays: [0, 1, 2, 18],
	},
	{
		id: "search-gateway",
		name: "search-gateway",
		kind: "HTTP API",
		endpoint: "https://search.northwind.dev/ready",
		region: "sin",
		status: "degraded",
		trend: "recovering",
		latencyMs: 488,
		errorRate: 0.008,
		latency: [320, 360, 610, 880, 940, 910, 840, 760, 702, 640, 600, 560, 530, 510, 495, 488],
		checkedAt: "2026-11-01T11:58:55Z",
		owner: "Discovery",
		version: "v1.31.4",
		interval: 30,
		age: 210,
		outages: [],
		slowDays: [0, 5, 6, 44],
	},
	{
		id: "auth-service",
		name: "auth-service",
		kind: "HTTP API",
		endpoint: "https://auth.northwind.dev/healthz",
		region: "fra",
		status: "up",
		trend: "stable",
		latencyMs: 84,
		errorRate: 0.0004,
		latency: [82, 85, 81, 84, 86, 83, 80, 82, 84, 85, 83, 82, 84, 86, 83, 84],
		checkedAt: "2026-11-01T11:59:50Z",
		owner: "Identity",
		version: "v9.2.1",
		interval: 30,
		age: 900,
		outages: [],
		slowDays: [33],
	},
	{
		id: "storefront-web",
		name: "storefront-web",
		kind: "Web app",
		endpoint: "https://www.northwind.dev",
		region: "iad",
		status: "up",
		trend: "stable",
		latencyMs: 142,
		errorRate: 0.0011,
		latency: [140, 138, 145, 150, 141, 139, 144, 148, 143, 140, 139, 142, 146, 141, 140, 142],
		checkedAt: "2026-11-01T11:59:30Z",
		owner: "Storefront",
		version: "v12.0.3",
		interval: 60,
		age: 900,
		outages: [23],
		slowDays: [22, 70],
	},
	{
		id: "inventory-db",
		name: "inventory-db",
		kind: "Postgres",
		endpoint: "tcp://inventory.db.northwind.internal:5432",
		region: "iad",
		status: "up",
		trend: "stable",
		latencyMs: 12,
		errorRate: 0,
		latency: [11, 12, 12, 13, 11, 12, 12, 12, 13, 12, 11, 12, 12, 12, 13, 12],
		checkedAt: "2026-11-01T11:59:45Z",
		owner: "Platform",
		version: "16.4",
		interval: 30,
		age: 900,
		outages: [],
		slowDays: [],
	},
	{
		id: "orders-queue",
		name: "orders-queue",
		kind: "Queue consumer",
		endpoint: "sqs://orders-prod",
		region: "iad",
		status: "up",
		trend: "stable",
		latencyMs: 46,
		errorRate: 0.0002,
		latency: [44, 48, 47, 45, 46, 49, 52, 47, 45, 44, 46, 47, 46, 45, 47, 46],
		checkedAt: "2026-11-01T11:59:20Z",
		owner: "Fulfilment",
		version: "v3.4.0",
		interval: 60,
		age: 520,
		outages: [23],
		slowDays: [],
	},
	{
		id: "media-cdn",
		name: "media-cdn",
		kind: "CDN origin",
		endpoint: "https://media.northwind.dev/ping",
		region: "gru",
		status: "up",
		trend: "stable",
		latencyMs: 64,
		errorRate: 0.0006,
		latency: [66, 64, 62, 65, 63, 61, 64, 66, 63, 62, 64, 65, 63, 64, 62, 64],
		checkedAt: "2026-11-01T11:58:40Z",
		owner: "Storefront",
		version: "edge-2026.10",
		interval: 30,
		age: 640,
		outages: [],
		slowDays: [12, 13],
	},
	{
		id: "notifications",
		name: "notifications",
		kind: "Worker",
		endpoint: "https://notify.northwind.dev/health",
		region: "sin",
		status: "up",
		trend: "stable",
		latencyMs: 131,
		errorRate: 0.0019,
		latency: [128, 133, 130, 129, 135, 132, 130, 128, 131, 134, 130, 129, 131, 133, 130, 131],
		checkedAt: "2026-11-01T11:59:05Z",
		owner: "Growth",
		version: "v1.9.12",
		interval: 60,
		age: 48,
		outages: [],
		slowDays: [30],
	},
	{
		id: "reports-cron",
		name: "reports-cron",
		kind: "Scheduled job",
		endpoint: "cron://reports-nightly",
		region: "fra",
		status: "paused",
		trend: "paused",
		latencyMs: null,
		errorRate: null,
		latency: [
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
			null,
		],
		checkedAt: "2026-10-28T03:00:00Z",
		owner: "Data",
		version: "v0.14.0",
		interval: 3600,
		age: 260,
		outages: [],
		slowDays: [],
	},
	{
		id: "recommendations",
		name: "recommendations",
		kind: "HTTP API",
		endpoint: "https://recs.northwind.dev/ready",
		region: "sin",
		status: "up",
		trend: "stable",
		latencyMs: 214,
		errorRate: 0.0031,
		latency: [220, 212, 218, 215, 210, 216, 219, 212, 214, 217, 213, 211, 215, 218, 216, 214],
		checkedAt: "2026-11-01T11:59:25Z",
		owner: "Discovery",
		version: "v5.0.0",
		interval: 30,
		age: 180,
		outages: [],
		slowDays: [2],
	},
	{
		id: "status-page",
		name: "status-page",
		kind: "Web app",
		endpoint: "https://status.northwind.dev",
		region: "gru",
		status: "up",
		trend: "stable",
		latencyMs: 98,
		errorRate: 0,
		latency: [97, 99, 98, 96, 100, 98, 97, 99, 98, 97, 98, 99, 97, 98, 99, 98],
		checkedAt: "2026-11-01T11:59:35Z",
		owner: "Platform",
		version: "v2.2.0",
		interval: 60,
		age: 900,
		outages: [],
		slowDays: [],
	},
];

/** An incident's place in its lifecycle. */
export type IncidentStatus = "investigating" | "monitoring" | "resolved";

/** One incident, opened against one service. */
export interface Incident {
	id: string;
	title: string;
	service: string;
	status: IncidentStatus;
	severity: "SEV1" | "SEV2" | "SEV3";
	startedAt: string;
	resolvedAt: string | null;
	commander: string;
}

/** Every incident in the last 90 days, newest first. */
export const INCIDENTS: readonly Incident[] = [
	{
		id: "INC-482",
		title: "Checkout requests time out in us-east",
		service: "checkout-api",
		status: "investigating",
		severity: "SEV1",
		startedAt: "2026-11-01T05:41:00Z",
		resolvedAt: null,
		commander: "Priya Raman",
	},
	{
		id: "INC-481",
		title: "Stripe webhooks retried with growing lag",
		service: "payments-webhooks",
		status: "investigating",
		severity: "SEV2",
		startedAt: "2026-11-01T09:12:00Z",
		resolvedAt: null,
		commander: "Tomás Ibarra",
	},
	{
		id: "INC-480",
		title: "Search p95 above 800 ms after index rebuild",
		service: "search-gateway",
		status: "monitoring",
		severity: "SEV3",
		startedAt: "2026-11-01T06:05:00Z",
		resolvedAt: null,
		commander: "Mei Lin",
	},
	{
		id: "INC-476",
		title: "Edge config push dropped TLS for 4 minutes",
		service: "storefront-web",
		status: "resolved",
		severity: "SEV1",
		startedAt: "2026-10-09T14:20:00Z",
		resolvedAt: "2026-10-09T14:24:00Z",
		commander: "Priya Raman",
	},
	{
		id: "INC-471",
		title: "Orders consumer stalled on a poison message",
		service: "orders-queue",
		status: "resolved",
		severity: "SEV2",
		startedAt: "2026-10-09T14:02:00Z",
		resolvedAt: "2026-10-09T15:10:00Z",
		commander: "Ana Duarte",
	},
	{
		id: "INC-466",
		title: "Checkout 502s during the regional failover drill",
		service: "checkout-api",
		status: "resolved",
		severity: "SEV2",
		startedAt: "2026-10-09T13:55:00Z",
		resolvedAt: "2026-10-09T14:40:00Z",
		commander: "Tomás Ibarra",
	},
	{
		id: "INC-452",
		title: "Webhook signing key rotated without a grace window",
		service: "payments-webhooks",
		status: "resolved",
		severity: "SEV2",
		startedAt: "2026-09-01T08:30:00Z",
		resolvedAt: "2026-09-01T09:05:00Z",
		commander: "Ana Duarte",
	},
];

/** One release of one service. */
export interface Deploy {
	id: string;
	service: string;
	version: string;
	author: string;
	at: string;
	/** Seconds from start to healthy; `null` when it rolled back. */
	durationS: number | null;
	outcome: "live" | "rolled-back";
}

/** Every deploy in the last week, newest first. */
export const DEPLOYS: readonly Deploy[] = [
	{
		id: "dpl_9f2c41",
		service: "checkout-api",
		version: "v4.18.2",
		author: "Priya Raman",
		at: "2026-11-01T11:32:00Z",
		durationS: 214,
		outcome: "live",
	},
	{
		id: "dpl_8a71de",
		service: "payments-webhooks",
		version: "v2.7.0",
		author: "Tomás Ibarra",
		at: "2026-11-01T08:50:00Z",
		durationS: 96,
		outcome: "live",
	},
	{
		id: "dpl_77b0c3",
		service: "search-gateway",
		version: "v1.31.4",
		author: "Mei Lin",
		at: "2026-11-01T05:40:00Z",
		durationS: 388,
		outcome: "live",
	},
	{
		id: "dpl_70c9aa",
		service: "checkout-api",
		version: "v4.18.1",
		author: "Priya Raman",
		at: "2026-10-31T16:05:00Z",
		durationS: null,
		outcome: "rolled-back",
	},
	{
		id: "dpl_6d13f0",
		service: "storefront-web",
		version: "v12.0.3",
		author: "Ana Duarte",
		at: "2026-10-31T10:12:00Z",
		durationS: 142,
		outcome: "live",
	},
	{
		id: "dpl_61e8b2",
		service: "notifications",
		version: "v1.9.12",
		author: "Jonas Berg",
		at: "2026-10-30T15:44:00Z",
		durationS: 61,
		outcome: "live",
	},
	{
		id: "dpl_5c02f9",
		service: "auth-service",
		version: "v9.2.1",
		author: "Mei Lin",
		at: "2026-10-29T09:03:00Z",
		durationS: 175,
		outcome: "live",
	},
	{
		id: "dpl_4fb771",
		service: "recommendations",
		version: "v5.0.0",
		author: "Jonas Berg",
		at: "2026-10-27T13:27:00Z",
		durationS: 233,
		outcome: "live",
	},
];

/**
 * Finds a service by its id.
 *
 * @param id The id from the path or a form.
 * @returns The service, or `undefined` for an id Pulse never watched.
 */
export function findService(id: string): Service | undefined {
	return SERVICES.find((service) => service.id === id);
}

/**
 * A service's last days, oldest first: hatched before it was first checked, paused since a
 * paused service stopped, and red or amber on the days it failed or ran slow.
 *
 * @param service The service to draw.
 * @param dayLabel Formats a day's tooltip from how many days ago it was.
 * @param count How many days to draw: 90 on a service's own page, fewer in the list.
 * @returns One period per day for a `StatusStrip`.
 */
export function uptimeDays(
	service: Service,
	dayLabel: (daysAgo: number) => string,
	count = 90,
): StatusStrip.Period[] {
	let days: StatusStrip.Period[] = [];
	for (let daysAgo = count - 1; daysAgo >= 0; daysAgo--) {
		let status: StatusStrip.Status = "up";
		if (daysAgo >= service.age) status = "no-data";
		else if (service.status === "paused" && daysAgo <= 4) status = "paused";
		else if (service.outages.includes(daysAgo)) status = "down";
		else if (service.slowDays.includes(daysAgo)) status = "degraded";
		days.push({ status, label: dayLabel(daysAgo) });
	}
	return days;
}

/**
 * The share of a service's checked days that stayed up, over the same days its strip draws.
 *
 * @param service The service to measure.
 * @param count How many days back to measure, matching the strip beside the figure.
 * @returns A ratio from 0 to 1, or `null` when nothing was checked.
 */
export function uptimeRatio(service: Service, count = 90): number | null {
	let checked = Math.min(service.age, count);
	if (checked === 0) return null;
	let outages = service.outages.filter((daysAgo) => daysAgo < count).length;
	let slow = service.slowDays.filter((daysAgo) => daysAgo < count).length;
	let lost = outages * 0.02 + slow * 0.002;
	return Math.max(0, 1 - lost / checked);
}

/**
 * The request's address without the one-shot toast, so every link a screen builds from it
 * (filters, sort, peek) never greets the visitor with the same toast twice.
 *
 * @param url The request's address.
 * @returns A copy without the `toast` parameter.
 */
export function withoutToast(url: URL): URL {
	let next = new URL(url);
	next.searchParams.delete("toast");
	return next;
}
