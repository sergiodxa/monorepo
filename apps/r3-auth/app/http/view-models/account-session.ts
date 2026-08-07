/**
 * Shapes a session row for the account area's device list: a user-agent string reduced
 * to browser/OS/device labels, dates already formatted for the request's language, and
 * the two flags the page renders differently — whether the row is the browser asking,
 * and whether it has gone quiet long enough to look abandoned.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { SessionWithClient } from "~/app/data/session";

/** How long a session may go untouched before the list marks it stale rather than active. */
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** Device classes the list distinguishes, each with its own translated label. */
export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

/** What a raw user-agent header was reduced to. */
export interface ParsedUserAgent {
	/** Browser family, or `"Unknown"` when no known token matched. */
	browser: string;
	/** Operating system family, or `"Unknown"` when no known token matched. */
	os: string;
	/** Device class, used to pick the row's translated device label. */
	deviceType: DeviceType;
}

/**
 * Reduces a user-agent header to browser, OS and device labels.
 *
 * Deliberately a token match rather than a parser: the values only ever help a person
 * recognize their own device in a list, so being approximate costs nothing while a
 * dependency that must keep up with every browser release would cost upkeep. A missing
 * or unrecognized header reads as `"Unknown"` instead of being hidden, because a
 * session the owner cannot identify is exactly the one they should consider revoking.
 */
export function parseUserAgent(ua: string | null): ParsedUserAgent {
	if (!ua) return { browser: "Unknown", os: "Unknown", deviceType: "unknown" };

	let browser = "Unknown";
	if (ua.includes("Firefox/")) browser = "Firefox";
	else if (ua.includes("Edg/")) browser = "Edge";
	else if (ua.includes("OPR/") || ua.includes("Opera/")) browser = "Opera";
	else if (ua.includes("Chrome/")) browser = "Chrome";
	else if (ua.includes("Safari/")) browser = "Safari";

	let os = "Unknown";
	if (ua.includes("Windows")) os = "Windows";
	else if (ua.includes("Android")) os = "Android";
	else if (ua.includes("iPhone") || ua.includes("iPad") || ua.includes("iOS")) os = "iOS";
	else if (ua.includes("Mac OS X") || ua.includes("Macintosh")) os = "macOS";
	else if (ua.includes("Linux")) os = "Linux";

	let deviceType: DeviceType = "desktop";
	if (ua.includes("iPad") || ua.includes("Tablet")) deviceType = "tablet";
	else if (ua.includes("Mobile") || ua.includes("Android") || ua.includes("iPhone")) {
		deviceType = "mobile";
	}

	return { browser, os, deviceType };
}

/** One row of the account area's device list, ready to render. */
export interface SessionRow {
	/**
	 * The session row's id, which is also the refresh token the client presents.
	 *
	 * It travels to the page only as the value the revoke form posts back, and only to
	 * the person who owns it. Nothing may log it or show it as text.
	 */
	id: string;
	/** Browser family label. */
	browser: string;
	/** Operating system label. */
	os: string;
	/** Device class, so the view can pick its translated label. */
	deviceType: DeviceType;
	/** The address the session was last seen from, when one was recorded. */
	ip: string | null;
	/** Name of the client the session was issued to, when its registration still exists. */
	clientName: string | null;
	/** When the session was last used, formatted for the request's language. */
	lastAccessed: string;
	/** When the session stops refreshing, formatted for the request's language. */
	expires: string;
	/** Whether this is the session the request itself arrived on. */
	isCurrent: boolean;
	/** Whether the session has gone untouched long enough to look abandoned. */
	isStale: boolean;
}

/**
 * Formats a date for a listing column: day, short month and year, in the request's
 * language, with no time — the list answers "which devices, roughly when", and a
 * timestamp to the second would only add noise.
 */
function formatDate(epochMs: number, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		year: "numeric",
		month: "short",
		day: "2-digit",
	}).format(new Date(epochMs));
}

/**
 * Maps a stored session onto its row.
 *
 * @param currentSessionId - The refresh token this request arrived with, so the row it
 *   names can be marked and confirmed differently from the rest.
 * @param locale - Language the dates are formatted for.
 */
export function toSessionRow(
	session: SessionWithClient,
	currentSessionId: string | null,
	locale: string,
): SessionRow {
	let ua = parseUserAgent(session.user_agent);
	let isCurrent = session.id === currentSessionId;

	return {
		id: session.id,
		browser: ua.browser,
		os: ua.os,
		deviceType: ua.deviceType,
		ip: session.ip_address,
		clientName: session.client?.name ?? null,
		lastAccessed: formatDate(session.updated_at, locale),
		expires: formatDate(session.expires_at, locale),
		isCurrent,
		// The current session is never stale by definition: this very request touched it.
		isStale: !isCurrent && Date.now() - session.updated_at > STALE_AFTER_MS,
	};
}
