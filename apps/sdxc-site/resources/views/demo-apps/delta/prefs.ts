/**
 * What one visitor did to their inbox and to the repository's settings, kept in their own
 * cookies: each notification's read, saved and done flags in a cookie of its own, so two quick
 * toggles never overwrite each other, and the settings they saved in one more.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoAppCookiePath } from "~/resources/views/demo-apps";

/** Every cookie this module writes starts with this, under Delta's shared `delta.` prefix. */
const PREFIX = "delta.";

/** One notification's flags live in `delta.inbox.<id>`. */
const INBOX_PREFIX = `${PREFIX}inbox.`;

/** The ids the last bulk Done moved, for its Undo. */
const UNDO_COOKIE = `${PREFIX}inbox-undo`;

/** The repository's settings as the visitor saved them. */
const SETTINGS_COOKIE = `${PREFIX}settings`;

/** The path every Delta cookie is sent under. */
const COOKIE_PATH = demoAppCookiePath("delta");

/** A week: long enough to come back to, short enough that the demo resets itself. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** A notification's flags as the visitor set them; unset flags keep the seed's. */
export interface InboxFlags {
	read?: boolean;
	saved?: boolean;
	done?: boolean;
}

/** The repository's settings: the seed's values until the visitor saves their own. */
export interface RepoSettings {
	name: string;
	description: string;
	website: string;
	issues: boolean;
	discussions: boolean;
	wiki: boolean;
	projects: boolean;
	/** The branch protection rule on `main`. */
	reviews: number;
	checks: boolean;
	linear: boolean;
	archived: boolean;
	/** Deleted, until the visitor presses Undo or resets the demo. */
	deleted: boolean;
}

/** The settings before anyone changes them. */
export const DEFAULT_SETTINGS: RepoSettings = {
	name: "delta",
	description:
		"The code-hosting demo on sdxc.dev, built from @sdxc/ui. You're reading its source: every file, commit and blame line comes from git.",
	website: "https://sdxc.dev/demo/apps/delta",
	issues: true,
	discussions: false,
	wiki: false,
	projects: true,
	reviews: 1,
	checks: true,
	linear: true,
	archived: false,
	deleted: false,
};

/** Everything this module reads from the visitor's cookies. */
export interface Prefs {
	inbox: Map<string, InboxFlags>;
	/** The notifications the last bulk Done moved. */
	undo: string[];
	settings: RepoSettings;
	/** The visitor has saved settings of their own. */
	customized: boolean;
}

/** Delta's cookies from a `Cookie` header, the first value of a name sent twice. */
function deltaCookies(header: string | null): Map<string, string> {
	let pairs = new Map<string, string>();
	for (let pair of (header ?? "").split(";")) {
		let [name = "", ...value] = pair.trim().split("=");
		if (name.startsWith(PREFIX) && !pairs.has(name)) pairs.set(name, value.join("="));
	}
	return pairs;
}

/** Whether a request carries anything a visitor did in Delta, so its pages draw fresh. */
export function hasPrefs(header: string | null): boolean {
	return deltaCookies(header).size > 0;
}

/** Reads a notification's flags from `r`, `s` and `d` letters, each with a `1` or `0` after it. */
function decodeFlags(value: string): InboxFlags {
	let flags: InboxFlags = {};
	for (let match of value.matchAll(/([rsd])([01])/g)) {
		let on = match[2] === "1";
		if (match[1] === "r") flags.read = on;
		if (match[1] === "s") flags.saved = on;
		if (match[1] === "d") flags.done = on;
	}
	return flags;
}

/** Writes a notification's flags as `r1s0d1`, leaving out the ones never set. */
function encodeFlags(flags: InboxFlags): string {
	let parts = [
		flags.read === undefined ? "" : `r${Number(flags.read)}`,
		flags.saved === undefined ? "" : `s${Number(flags.saved)}`,
		flags.done === undefined ? "" : `d${Number(flags.done)}`,
	];
	return parts.join("");
}

/**
 * Reads the saved settings, checking every field and falling back to the seed's value for any
 * that is missing or malformed, so a tampered cookie reads as the defaults.
 */
function decodeSettings(value: string | undefined): RepoSettings | undefined {
	if (value === undefined || value === "") return undefined;
	try {
		let parsed: unknown = JSON.parse(decodeURIComponent(value));
		if (typeof parsed !== "object" || parsed === null) return undefined;
		let record = parsed as Record<string, unknown>;
		let text = (key: "name" | "description" | "website", max: number) =>
			typeof record[key] === "string"
				? (record[key] as string).slice(0, max)
				: DEFAULT_SETTINGS[key];
		let flag = (key: keyof RepoSettings) =>
			typeof record[key] === "boolean"
				? (record[key] as boolean)
				: (DEFAULT_SETTINGS[key] as boolean);
		let reviews = Number(record["reviews"]);
		return {
			name: text("name", 100),
			description: text("description", 350),
			website: text("website", 200),
			issues: flag("issues"),
			discussions: flag("discussions"),
			wiki: flag("wiki"),
			projects: flag("projects"),
			reviews: Number.isInteger(reviews) && reviews >= 0 && reviews <= 6 ? reviews : 1,
			checks: flag("checks"),
			linear: flag("linear"),
			archived: flag("archived"),
			deleted: flag("deleted"),
		};
	} catch {
		return undefined;
	}
}

/**
 * Reads the visitor's inbox flags and settings from the request's `Cookie` header.
 *
 * @param header The request's `Cookie` header.
 */
export function readPrefs(header: string | null): Prefs {
	let cookies = deltaCookies(header);
	let inbox = new Map<string, InboxFlags>();
	for (let [name, value] of cookies) {
		if (name.startsWith(INBOX_PREFIX))
			inbox.set(name.slice(INBOX_PREFIX.length), decodeFlags(value));
	}
	let saved = decodeSettings(cookies.get(SETTINGS_COOKIE));
	let undo = (cookies.get(UNDO_COOKIE) ?? "")
		.split(".")
		.filter((id) => /^[a-z0-9-]{1,24}$/.test(id));
	return { inbox, undo, settings: saved ?? DEFAULT_SETTINGS, customized: saved !== undefined };
}

/** A `Set-Cookie` value scoped to Delta's own path; `null` expires it. */
function cookieHeader(name: string, value: string | null): string {
	let age = value === null ? 0 : COOKIE_MAX_AGE;
	return `${name}=${value ?? ""}; Path=${COOKIE_PATH}; Max-Age=${age}; SameSite=Lax; HttpOnly`;
}

/**
 * The cookie recording one notification's flags after a change, merged over what it had.
 *
 * @param prefs The visitor's prefs before the change.
 * @param id The notification's id.
 * @param change The flags to set.
 */
export function inboxCookie(prefs: Prefs, id: string, change: InboxFlags): string {
	let flags = { ...prefs.inbox.get(id), ...change };
	return cookieHeader(`${INBOX_PREFIX}${id}`, encodeFlags(flags));
}

/** The cookie remembering which notifications a bulk Done moved, or clearing it. */
export function undoCookie(ids: readonly string[]): string {
	return cookieHeader(UNDO_COOKIE, ids.length === 0 ? null : ids.join("."));
}

/** The cookie holding the settings after a save. */
export function settingsCookie(settings: RepoSettings): string {
	return cookieHeader(SETTINGS_COOKIE, encodeURIComponent(JSON.stringify(settings)));
}

/**
 * Expires every Delta cookie a request carries, which resets the demo.
 *
 * @param header The request's `Cookie` header.
 */
export function clearPrefs(header: string | null): string[] {
	return [...deltaCookies(header).keys()].map((name) => cookieHeader(name, null));
}
