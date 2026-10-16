/**
 * What a page's social card says and where it is served from. Marketing and docs cards read
 * the rendered page's own headline and tags; a status page's card reads the same overview the
 * page shows, so both report one status. A card's URL is its page's path with `.png` added.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UptimeModels } from "~/app/models";
import type { ServiceStatus } from "~/app/services/status-page";
import type { StatusPageOverview } from "~/app/services/status-page-overview";

import { UPTIME_WINDOW_DAYS } from "~/app/models/monitor-daily-stats";
import { absoluteUrl, APP_ORIGIN } from "~/config/origin";

export namespace SocialCard {
	/** What a rendered marketing or docs page states about itself. */
	export interface Page {
		/** The document title, `Name | Section` or the product's own name. */
		title: string;
		description: string;
		/** The page's visible headline, when it has one. */
		headline: string | null;
		/** The headline's highlighted phrase, drawn in the accent colour. */
		accent: string | null;
		/** The page's path, `/` for the home page. */
		path: string;
	}

	/** A marketing or docs page's card: what kind of page, its headline and its summary. */
	export interface MarketingContent {
		kind: "marketing";
		eyebrow: string;
		/** The headline without its highlighted phrase. */
		title: string;
		accent: string | null;
		description: string;
		url: string;
	}

	/** One day of a service's uptime bars; `null` for a day with no checks. */
	export type Day = "up" | "degraded" | "down" | null;

	/** One service as the status card lists it. */
	export interface Service {
		name: string;
		status: ServiceStatus;
		/** Uptime over the completed days in the window, `99.95%`, or `null` without data. */
		uptime: string | null;
		/** The window's days, oldest first, today last. */
		days: Day[];
	}

	/** A status page's card: its title, overall status and when it began, and its services. */
	export interface StatusContent {
		kind: "status";
		title: string;
		status: ServiceStatus;
		/** When the current status began, worded for the card. */
		since: string;
		services: Service[];
		/** How many services the card leaves out for space. */
		more: number;
		url: string;
	}

	export type Content = MarketingContent | StatusContent;
}

/** The size social platforms render a large card at. */
export const SOCIAL_CARD_SIZE = { width: 1200, height: 630 } as const;

/**
 * Names the card design. Changing the drawing changes this, which changes every card's
 * storage key and URL, so platforms and storage pick up the new design with no purge.
 */
export const SOCIAL_CARD_TEMPLATE = "1";

/** How many services a status card lists before summarizing the rest. */
export const STATUS_CARD_SERVICES = 3;

/** This app's folder in the shared card bucket, which a lifecycle rule can target alone. */
const SOCIAL_CARD_PREFIX = "uptime";

/** The separator every page title puts between its own name and the section it belongs to. */
const TITLE_SEPARATOR = " | ";

/** The segment the home page's card is stored under, since `/` leaves no name for a file. */
const HOME_SEGMENT = "index";

/** A day of the window as the daily stats key it, `2026-10-16`. */
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** When an incident began, worded in UTC so every reader sees the same time. */
const INCIDENT_TIME = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
	timeZone: "UTC",
});

/** The eyebrow for each marketing section, by the first segment of its path. */
const EYEBROWS: Record<string, string> = {
	features: "Feature",
	for: "Built for",
	"use-cases": "Use case",
	vs: "Comparison",
	docs: "Docs",
	"browser-flows": "Browser flows",
	trust: "Trust",
	legal: "Legal",
};

/**
 * A marketing or docs page's card. The visible headline leads when the page has one, its
 * highlighted phrase kept apart for the accent colour; otherwise the title's own name does.
 */
export function marketingCardContent(page: SocialCard.Page): SocialCard.MarketingContent {
	let separator = page.title.indexOf(TITLE_SEPARATOR);
	let name = separator === -1 ? page.title : page.title.slice(0, separator);
	let headline = page.headline?.trim() || name;
	let accent = page.accent?.trim() || null;
	let title =
		accent && headline.endsWith(accent) ? headline.slice(0, -accent.length).trim() : headline;
	let host = new URL(APP_ORIGIN).host;
	return {
		kind: "marketing",
		eyebrow: EYEBROWS[page.path.split("/")[1] ?? ""] ?? "Uptime Monitoring",
		title,
		accent: title === headline ? null : accent,
		description: page.description,
		url: page.path === "/" ? host : `${host}${page.path}`,
	};
}

/**
 * A status page's card, from the overview the page shows. Uptime counts completed days only
 * and today's bar follows today's status, so the card changes with a status change or a new
 * day, never with each check.
 *
 * @param since - When the current status began, from {@link describeSince}
 * @param today - Today's day key in UTC, the last day of the window
 */
export function statusCardContent(
	page: { title: string; slug: string },
	overview: StatusPageOverview,
	since: string,
	today: string,
): SocialCard.StatusContent {
	let window = windowDays(today);
	let services = overview.barServices.map((service) => {
		let byDay = new Map(service.days.map((day) => [day.date, day]));
		let completed = service.days.filter((day) => day.date !== today);
		let total = completed.reduce((sum, day) => sum + day.total_checks, 0);
		let successful = completed.reduce((sum, day) => sum + day.successful_checks, 0);
		return {
			name: service.name,
			status: service.status,
			uptime: total === 0 ? null : `${((successful / total) * 100).toFixed(2)}%`,
			days: window.map((day) => asDay(byDay.get(day)?.status)),
		};
	});
	return {
		kind: "status",
		title: page.title,
		status: overview.overallStatus,
		since,
		services: services.slice(0, STATUS_CARD_SERVICES),
		more: Math.max(0, services.length - STATUS_CARD_SERVICES),
		url: `${new URL(APP_ORIGIN).host}/status/${page.slug}`,
	};
}

/**
 * A public status page's card from the overview the page shows. When the page is in an
 * incident, its start comes from the affected services' alert events.
 *
 * @param now - The moment the card describes; today's bar and the streak count from it
 */
export async function loadStatusCard(
	models: UptimeModels,
	page: { title: string; slug: string },
	overview: StatusPageOverview,
	now = new Date(),
): Promise<SocialCard.StatusContent> {
	let today = now.toISOString().slice(0, 10);
	let affected = overview.barServices.filter(
		(service) => service.status === "degraded" || service.status === "down",
	);
	let starts = await Promise.all(
		affected.map((service) => models.alertEvents.openIncidentSince(service.id)),
	);
	let known = starts.filter((start): start is number => start !== null);
	let since = describeSince(overview, today, known.length > 0 ? Math.min(...known) : null);
	return statusCardContent(page, overview, since, today);
}

/**
 * Words when the current status began. An operational page counts the days its services
 * have run without downtime; a page in an incident names when the incident began, or the
 * day when no alert recorded its start.
 *
 * @param incidentStart - The earliest open incident's start, in milliseconds, if any
 */
export function describeSince(
	overview: StatusPageOverview,
	today: string,
	incidentStart: number | null,
): string {
	if (overview.overallStatus === "operational" || overview.overallStatus === "unknown") {
		let streak = cleanStreak(overview, today);
		if (streak === 0) return "Operational";
		return `No downtime in ${streak} ${streak === 1 ? "day" : "days"}`;
	}
	if (incidentStart !== null) return `Since ${INCIDENT_TIME.format(incidentStart)} UTC`;
	return `As of ${today}`;
}

/**
 * The absolute URL a page advertises as its `og:image`: its path with `.png` added and a
 * version that changes with what the card shows, so platforms that cache per URL fetch again.
 */
export function socialCardUrl(path: string, version: string): string {
	let segment = path === "/" ? `/${HOME_SEGMENT}` : path.replace(/\/$/, "");
	return absoluteUrl(`${segment}.png?v=${version}`);
}

/**
 * The version a marketing page's card URL carries, from the title, description and path the
 * page's layout knows; a status card's version is its content's hash.
 */
export function marketingCardVersion(title: string, description: string, path: string): string {
	return socialCardHash({
		kind: "marketing",
		eyebrow: "",
		title,
		accent: null,
		description,
		url: path,
	});
}

/** The page path a card request's path stands for, `/index.png` being the home page's. */
export function pagePathFromCardPath(pathname: string): string {
	let path = pathname.slice(1, -".png".length);
	return path === HOME_SEGMENT ? "/" : `/${path}`;
}

/**
 * Where the card whose content hashes to `hash` is stored, under this app's prefix in the
 * shared bucket. A card URL's `v` is that hash, so a request names its object directly.
 */
export function socialCardKey(hash: string): string {
	return `${SOCIAL_CARD_PREFIX}/${SOCIAL_CARD_TEMPLATE}/${hash}.png`;
}

/**
 * A short, stable fingerprint of the card's content and template. It only has to tell one
 * card's text from another's, so a fast synchronous 53-bit hash (cyrb53) is enough.
 */
export function socialCardHash(content: SocialCard.Content): string {
	let input = `${SOCIAL_CARD_TEMPLATE}\u0000${JSON.stringify(content)}`;
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let index = 0; index < input.length; index++) {
		let code = input.charCodeAt(index);
		h1 = Math.imul(h1 ^ code, 2654435761);
		h2 = Math.imul(h2 ^ code, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Reads a rendered marketing page's card facts: its `og:title` and `og:description`, and its
 * first `<h1>` with the text of a `<span>` inside it as the highlighted phrase. `null` when the
 * page states no title.
 */
export function readPageFacts(html: string, path: string): SocialCard.Page | null {
	let title = metaContent(html, "og:title");
	if (title === null) return null;
	let heading = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? null;
	let accent = heading ? (/<span\b[^>]*>([\s\S]*?)<\/span>/i.exec(heading)?.[1] ?? null) : null;
	return {
		title,
		description: metaContent(html, "og:description") ?? "",
		headline: heading === null ? null : textOf(heading),
		accent: accent === null ? null : textOf(accent),
		path,
	};
}

/** A stored day status as a bar, any value outside the three a day records reading as no data. */
function asDay(status: string | undefined): SocialCard.Day {
	return status === "up" || status === "degraded" || status === "down" ? status : null;
}

/** The window's day keys in UTC, oldest first, ending with `today`. */
function windowDays(today: string): string[] {
	if (!DAY_KEY.test(today)) return [];
	let end = Date.parse(`${today}T00:00:00Z`);
	return Array.from({ length: UPTIME_WINDOW_DAYS }, (_, index) =>
		new Date(end - (UPTIME_WINDOW_DAYS - 1 - index) * 86_400_000).toISOString().slice(0, 10),
	);
}

/**
 * How many days in a row, ending today, every service ran without a degraded or down day.
 * A day a service has no data for neither breaks nor extends the streak.
 */
function cleanStreak(overview: StatusPageOverview, today: string): number {
	let days = windowDays(today).reverse();
	let streak = 0;
	for (let day of days) {
		let statuses = overview.barServices.flatMap((service) =>
			service.days.filter((entry) => entry.date === day).map((entry) => entry.status),
		);
		if (statuses.some((status) => status !== "up")) break;
		if (statuses.length > 0) streak++;
	}
	return streak;
}

/** The decoded `content` of the `<meta property>` naming `property`, or `null`. */
function metaContent(html: string, property: string): string | null {
	for (let match of html.matchAll(/<meta\b[^>]*>/g)) {
		let tag = match[0];
		if (attribute(tag, "property") !== property) continue;
		return attribute(tag, "content");
	}
	return null;
}

/** One attribute's decoded value in a tag, quoted either way, or `null`. */
function attribute(tag: string, name: string): string | null {
	let value = new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`).exec(tag);
	if (!value) return null;
	return decodeEntities(value[1] ?? value[2] ?? "");
}

/** A fragment's text with its tags removed, entities decoded and whitespace collapsed. */
function textOf(fragment: string): string {
	return decodeEntities(fragment.replace(/<[^>]*>/g, " "))
		.replace(/\s+/g, " ")
		.trim();
}

/** The named references markup carries. */
const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
};

/** Decodes the character references an HTML serializer writes. */
function decodeEntities(value: string): string {
	return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
		let lower = entity.toLowerCase();
		if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
		if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
		return NAMED_ENTITIES[lower] ?? whole;
	});
}
