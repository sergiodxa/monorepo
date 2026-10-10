/**
 * Shapes a session row for the account area's device list: a user-agent string reduced
 * to browser/OS/device labels, dates already formatted for the request's language, and
 * the two flags the page renders differently — whether the row is the browser asking,
 * and whether it has gone quiet long enough to look abandoned.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DeviceType as ParsedDeviceType } from "@sdxc/user-agent";

import { formatParts } from "@sdxc/dates";
import { parse } from "@sdxc/user-agent";

import type { SessionWithClient } from "~/app/models/sessions";

/** How long a session may go untouched before the list marks it stale. */
const STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** Device classes the list distinguishes, each with its own translated label. */
export type DeviceType = "desktop" | "mobile" | "tablet" | "unknown";

/** The labels a raw user-agent header reads as in the device list and the sign-in notice. */
export interface UserAgentDescription {
	/** Browser family, or `"Unknown"` when the header names none the parser recognizes. */
	browser: string;
	/** Operating system family, or `"Unknown"` when the header names none the parser recognizes. */
	os: string;
	/** Device class, used to pick the row's translated device label. */
	deviceType: DeviceType;
}

/**
 * Reduces a user-agent header to the labels a person recognizes their own device by. A
 * missing or unrecognized header reads as `"Unknown"`, flagging the session as one worth
 * revoking; consoles and televisions take the unknown device label.
 */
export function describeUserAgent(header: string | null): UserAgentDescription {
	let { browser, os, device } = parse(header ?? "");

	return {
		browser: browser.name ?? "Unknown",
		os: os.name ?? "Unknown",
		deviceType: toDeviceType(device.type),
	};
}

/** Narrows the parser's device classes to the ones the list and the notice carry a label for. */
function toDeviceType(type: ParsedDeviceType | null): DeviceType {
	if (type === "desktop" || type === "mobile" || type === "tablet") return type;
	return "unknown";
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
 * Formats a date for a listing column: day, short month and year of the UTC calendar,
 * in the request's language. The list answers "which devices, roughly when", so
 * second-level precision would only add noise.
 */
function formatDate(epochMs: number, locale: string): string {
	return formatParts(new Date(epochMs), {
		locale,
		timeZone: "UTC",
		year: "numeric",
		month: "short",
		day: "2-digit",
	})
		.map((part) => part.value)
		.join("");
}

/**
 * Maps a stored session onto its row. The session matching the current request's
 * token stays marked active, since this very request just touched it.
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
	let ua = describeUserAgent(session.user_agent);
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
		isStale: !isCurrent && Date.now() - session.updated_at > STALE_AFTER_MS,
	};
}
