/**
 * What one visitor changed on Sundial, kept in their own cookies: events they made, moved or
 * deleted, the calendars they hid, the zones they read the day in, and the change one Undo
 * reverses. The server reads them to draw every screen, so all of it works without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSCalendar } from "@sdxc/jscalendar";

import { iife } from "@sdxc/iife";
import { applyPatch, parse } from "@sdxc/jscalendar";
import { isSuccess } from "@sdxc/result";

import { demoAppCookiePath } from "~/resources/views/demo-apps";

import type { Entry } from "./model";

import { CALENDARS, DEFAULT_SECOND_ZONE, DEFAULT_ZONE, SLUG, ZONES, seedDefinitions } from "./data";
import { isEditable, toEntry } from "./model";

/** Every Sundial cookie starts with this. */
const COOKIE_PREFIX = "sundial.";

/** The cookie the sidebar's collapsed state is remembered in. */
export const SHELL_COOKIE = "sundial-sidebar";

/** A week: long enough to come back to, short enough that the demo resets itself. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** The longest a stored value may be once encoded, so each cookie stays under a browser's 4 KB. */
const VALUE_LIMIT = 3600;

/** What the visitor changed about the seed calendar. */
export interface Changes {
	/** Events the visitor made or imported, each filed under a calendar. */
	added: Entry[];
	/** JSCalendar PatchObjects the visitor applied to seed events, by uid. */
	patched: Record<string, JSCalendar.PatchObject>;
	/** Seed events the visitor deleted, by uid. */
	deleted: string[];
}

/** Everything a screen reads about the visitor. */
export interface Visitor {
	changes: Changes;
	/** Calendar ids the visitor turned off. */
	hidden: string[];
	/** The zone the grid's hours follow. */
	zone: string;
	/** The second column of hours, or `null` for none. */
	second: string | null;
	/** The change an Undo puts back, and the page it returns to. */
	undo: { changes: Changes; back: string } | null;
}

/** An empty set of changes. */
function noChanges(): Changes {
	return { added: [], patched: {}, deleted: [] };
}

/** Splits a `Cookie` header into Sundial's pairs, the first of a repeated name winning. */
function sundialCookies(header: string | null): Map<string, string> {
	let pairs = new Map<string, string>();
	for (let pair of (header ?? "").split(";")) {
		let [name = "", ...value] = pair.trim().split("=");
		if (name.startsWith(COOKIE_PREFIX) && !pairs.has(name)) pairs.set(name, value.join("="));
	}
	return pairs;
}

/** Reads a JSON cookie value, or `null` when it is missing or unreadable. */
function readJson(value: string | undefined): unknown {
	if (value === undefined || value === "") return null;
	try {
		return JSON.parse(decodeURIComponent(value));
	} catch {
		return null;
	}
}

/** A JSCalendar Event read from a cookie, or `null` when it is not one RFC 8984 accepts. */
function readEvent(value: unknown): JSCalendar.Event | null {
	let parsed = parse(value);
	return isSuccess(parsed) && parsed.data["@type"] === "Event" ? parsed.data : null;
}

/** Reads a set of changes, dropping anything that is not a valid event on a known calendar. */
function readChanges(value: unknown): Changes {
	if (typeof value !== "object" || value === null) return noChanges();
	let raw = value as Partial<Changes>;
	let added: Entry[] = [];
	for (let entry of Array.isArray(raw.added) ? raw.added : []) {
		if (typeof entry !== "object" || entry === null) continue;
		let event = readEvent((entry as { event?: unknown }).event);
		let calendar = (entry as { calendar?: unknown }).calendar;
		if (event && typeof calendar === "string" && isEditable(calendar))
			added.push({ calendar, event });
	}
	let patched: Changes["patched"] = {};
	if (typeof raw.patched === "object" && raw.patched !== null) {
		for (let [uid, patch] of Object.entries(raw.patched)) {
			if (typeof patch === "object" && patch !== null)
				patched[uid] = patch as JSCalendar.PatchObject;
		}
	}
	let deleted = Array.isArray(raw.deleted)
		? raw.deleted.filter((uid): uid is string => typeof uid === "string")
		: [];
	return { added, patched, deleted };
}

/**
 * Whether a request carries anything; a calendar reads the clock, so every Sundial screen
 * renders fresh, and a stored copy never shows yesterday as today.
 */
export function isPersonal(): boolean {
	return true;
}

/**
 * Reads what the visitor changed and chose. Unknown zones fall back to the defaults, and
 * unreadable changes read as none, so a tampered cookie can only lose the visitor's edits.
 *
 * @param header The request's `Cookie` header.
 */
export function readVisitor(header: string | null): Visitor {
	let cookies = sundialCookies(header);
	let zones = (cookies.get(`${COOKIE_PREFIX}zones`) ?? "").split(",").map(decodeURIComponent);
	let zone = ZONES.some((entry) => entry.id === zones[0]) ? zones[0]! : DEFAULT_ZONE;
	let second = iife(() => {
		if (zones[1] === "none") return null;
		return ZONES.some((entry) => entry.id === zones[1]) ? zones[1]! : DEFAULT_SECOND_ZONE;
	});
	let hidden = (cookies.get(`${COOKIE_PREFIX}hidden`) ?? "")
		.split(",")
		.filter((id) => CALENDARS.some((calendar) => calendar.id === id));
	let undoValue = readJson(cookies.get(`${COOKIE_PREFIX}undo`));
	let undo =
		typeof undoValue === "object" && undoValue !== null && "changes" in undoValue
			? {
					changes: readChanges((undoValue as { changes: unknown }).changes),
					back: iife(() => {
						let back = (undoValue as { back?: unknown }).back;
						return typeof back === "string" ? back : "";
					}),
				}
			: null;
	return {
		changes: readChanges(readJson(cookies.get(`${COOKIE_PREFIX}changes`))),
		hidden,
		zone,
		second: second === zone ? null : second,
		undo,
	};
}

/** The seed calendar for the week holding `today`, as JSCalendar entries. */
export function seedEntries(today: string): Entry[] {
	return seedDefinitions(today).map(toEntry);
}

/**
 * The visitor's calendar: the seed for their week with their patches applied, deletions removed,
 * and their own events added. A patch that no longer applies, or that leaves an event RFC 8984
 * rejects, is skipped and the seed shows as it was.
 *
 * @param visitor What the visitor changed.
 * @param today Their today, which the seed is set around.
 */
export function eventsOf(visitor: Visitor, today: string): Entry[] {
	let { added, patched, deleted } = visitor.changes;
	let seed = seedEntries(today)
		.filter((entry) => !deleted.includes(entry.event.uid))
		.map((entry) => {
			let patch = patched[entry.event.uid];
			if (patch === undefined) return entry;
			let applied = applyPatch(entry.event, patch);
			let event = isSuccess(applied) ? readEvent(applied.data) : null;
			return event ? { ...entry, event } : entry;
		});
	return [...seed, ...added.filter((entry) => !deleted.includes(entry.event.uid))];
}

/** One `Set-Cookie` value under the app's own path. */
function cookieHeader(name: string, value: string, maxAge = COOKIE_MAX_AGE): string {
	return `${COOKIE_PREFIX}${name}=${value}; Path=${demoAppCookiePath(SLUG)}; Max-Age=${maxAge}; SameSite=Lax; HttpOnly`;
}

/**
 * The cookies that store a new set of changes and remember the old one for Undo.
 *
 * @param visitor The visitor as the request found them.
 * @param next Their changes after this post.
 * @param back The page an Undo returns to.
 */
export function changesCookies(visitor: Visitor, next: Changes, back: string): string[] {
	let undo = encodeURIComponent(JSON.stringify({ changes: visitor.changes, back }));
	return [
		cookieHeader("changes", encodeChanges(next)),
		cookieHeader(
			"undo",
			undo.length <= VALUE_LIMIT ? undo : "",
			undo.length <= VALUE_LIMIT ? undefined : 0,
		),
	];
}

/** Changes encoded for a cookie, dropping the visitor's oldest events until the value fits. */
function encodeChanges(changes: Changes): string {
	let added = changes.added;
	let value = encodeURIComponent(JSON.stringify(changes));
	while (value.length > VALUE_LIMIT && added.length > 0) {
		added = added.slice(1);
		value = encodeURIComponent(JSON.stringify({ ...changes, added }));
	}
	return value;
}

/** The cookies an Undo answers with: the old changes back, and nothing left to undo. */
export function undoCookies(visitor: Visitor): string[] {
	if (visitor.undo === null) return [];
	return [
		cookieHeader("changes", encodeChanges(visitor.undo.changes)),
		cookieHeader("undo", "", 0),
	];
}

/** The cookie holding the hidden calendars. */
export function hiddenCookie(hidden: string[]): string {
	return cookieHeader("hidden", hidden.join(","));
}

/** The cookie holding the viewer's zone and their second one (`none` for no second column). */
export function zonesCookie(zone: string, second: string | null): string {
	return cookieHeader("zones", [zone, second ?? "none"].map(encodeURIComponent).join(","));
}

/** The cookies a reset answers with: every Sundial cookie the request carries, expired. */
export function resetCookies(header: string | null): string[] {
	return [...sundialCookies(header).keys()].map((name) =>
		cookieHeader(name.slice(COOKIE_PREFIX.length), "", 0),
	);
}
