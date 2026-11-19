/**
 * What one visitor changed on Sundial, kept in their own cookies: events they made, moved or
 * deleted, the calendars they hid, the zones they read the day in, and the change one Undo
 * reverses. The server reads them to draw every screen, so all of it works without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { iife } from "@sdxc/iife";

import { demoAppCookiePath } from "~/resources/views/demo-apps";

import type { CalendarEvent } from "./data";

import {
	CALENDARS,
	COLORS,
	DEFAULT_SECOND_ZONE,
	DEFAULT_ZONE,
	REPEATS,
	SLUG,
	ZONES,
	findPerson,
	seedEvents,
} from "./data";

/** Every Sundial cookie starts with this. */
const COOKIE_PREFIX = "sundial.";

/** The cookie the sidebar's collapsed state is remembered in. */
export const SHELL_COOKIE = "sundial-sidebar";

/** A week: long enough to come back to, short enough that the demo resets itself. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** The most events a visitor's own list keeps, oldest dropped first, so the cookie stays small. */
const ADDED_LIMIT = 14;

/** What the visitor changed about the seed calendar. */
export interface Changes {
	/** Events the visitor made, and single repeats they moved out of a series. */
	added: CalendarEvent[];
	/** Fields the visitor changed on seed events, by id. */
	patched: Record<string, Partial<CalendarEvent>>;
	/** Seed events the visitor deleted. */
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

/** Whether a value read from a cookie is an event this demo can draw. */
function isEvent(value: unknown): value is CalendarEvent {
	if (typeof value !== "object" || value === null) return false;
	let event = value as Partial<CalendarEvent>;
	return (
		typeof event.id === "string" &&
		typeof event.title === "string" &&
		typeof event.date === "string" &&
		/^\d{4}-\d{2}-\d{2}$/.test(event.date) &&
		(event.start === null || typeof event.start === "number") &&
		typeof event.length === "number" &&
		event.length > 0 &&
		CALENDARS.some((calendar) => calendar.id === event.calendar) &&
		ZONES.some((zone) => zone.id === event.zone) &&
		REPEATS.some((repeat) => repeat.id === event.repeat) &&
		Array.isArray(event.guests) &&
		event.guests.every((guest) => findPerson(guest) !== undefined) &&
		(event.color === undefined || COLORS.some((color) => color.id === event.color))
	);
}

/** Reads a set of changes, dropping anything that is not an event this demo can draw. */
function readChanges(value: unknown): Changes {
	if (typeof value !== "object" || value === null) return noChanges();
	let raw = value as Partial<Changes>;
	let added = Array.isArray(raw.added) ? raw.added.filter(isEvent) : [];
	let patched: Changes["patched"] = {};
	if (typeof raw.patched === "object" && raw.patched !== null) {
		for (let [id, patch] of Object.entries(raw.patched)) {
			if (typeof patch === "object" && patch !== null) patched[id] = patch;
		}
	}
	let deleted = Array.isArray(raw.deleted)
		? raw.deleted.filter((id): id is string => typeof id === "string")
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

/**
 * The visitor's calendar: the seed for their week with their edits applied, deletions removed,
 * and their own events added.
 *
 * @param visitor What the visitor changed.
 * @param today Their today, which the seed is set around.
 */
export function eventsOf(visitor: Visitor, today: string): CalendarEvent[] {
	let { added, patched, deleted } = visitor.changes;
	let seed = seedEvents(today)
		.filter((event) => !deleted.includes(event.id))
		.map((event) => {
			let patch = patched[event.id];
			if (patch === undefined) return event;
			let merged = { ...event, ...patch, id: event.id };
			return isEvent(merged) ? merged : event;
		});
	return [...seed, ...added.filter((event) => !deleted.includes(event.id))];
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
	let trimmed = { ...next, added: next.added.slice(-ADDED_LIMIT) };
	return [
		cookieHeader("changes", encodeURIComponent(JSON.stringify(trimmed))),
		cookieHeader("undo", encodeURIComponent(JSON.stringify({ changes: visitor.changes, back }))),
	];
}

/** The cookies an Undo answers with: the old changes back, and nothing left to undo. */
export function undoCookies(visitor: Visitor): string[] {
	if (visitor.undo === null) return [];
	return [
		cookieHeader("changes", encodeURIComponent(JSON.stringify(visitor.undo.changes))),
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
