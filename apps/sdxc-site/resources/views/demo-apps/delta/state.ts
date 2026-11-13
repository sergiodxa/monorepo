/**
 * What one visitor did in Delta, kept in their own cookies: each issue's or pull request's
 * edits (state, labels, assignees, reviewers, merge, files viewed, threads resolved, a pending
 * review) in a cookie of its own, and the comments they wrote in one more.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoAppCookiePath } from "~/resources/views/demo-apps";

/** Every Delta cookie that records a visitor's work starts with this. */
export const COOKIE_PREFIX = "delta.";

/** The path every Delta cookie is sent under. */
const COOKIE_PATH = demoAppCookiePath("delta");

/** The cookie holding the comments the visitor wrote. */
export const COMMENTS_COOKIE = `${COOKIE_PREFIX}c`;

/** How many comments, or pending review comments, are kept; the oldest goes first. */
const KEPT = 8;

/** The most a cookie's value may weigh, under a browser's 4 KB per cookie. */
const COOKIE_BYTES = 3600;

/** A week: long enough to come back to, short enough that the demo resets itself. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** How long after an edit a record's save status still reads "Saved". */
export const SAVED_WINDOW_MS = 4000;

/** How a pull request lands. */
export type MergeMethod = "merge" | "squash" | "rebase";

/** What a submitted review says. */
export type ReviewKind = "comment" | "approve" | "changes";

/** A review comment on lines of a pull request's files. */
export interface LineComment {
	id: string;
	path: string;
	side: "L" | "R";
	start: number;
	end: number;
	body: string;
	at: number;
}

/** Everything the visitor changed on one issue or pull request; unset fields keep the seed's. */
export interface RecordEdit {
	/** When the visitor last changed it, in epoch milliseconds. */
	at: number;
	state?: "open" | "closed";
	labels?: string[];
	assignees?: string[];
	/** `null` clears the milestone. */
	milestone?: string | null;
	reviewers?: string[];
	merged?: { at: number; method: MergeMethod };
	/** Paths of the files marked viewed. */
	viewed?: string[];
	/** Threads the visitor resolved (`true`) or reopened (`false`), by thread id. */
	resolved?: Record<string, boolean>;
	/** Review comments not yet submitted. */
	pending?: LineComment[];
	/** Review comments the visitor submitted, which now open threads of their own. */
	posted?: LineComment[];
	/** The visitor's submitted review. */
	review?: { kind: ReviewKind; body: string; at: number };
}

/** A comment the visitor wrote: on an issue's or pull request's conversation, or in a thread. */
export interface VisitorComment {
	id: string;
	/** The issue or pull request's number. */
	number: number;
	/** The thread it replies in; absent for a conversation comment. */
	thread?: string;
	body: string;
	at: number;
}

/** Everything the visitor changed. */
export interface VisitorState {
	records: Map<number, RecordEdit>;
	comments: VisitorComment[];
}

/**
 * Splits a `Cookie` header into Delta's pairs. A name sent twice reads as its first value,
 * which the browser sends for the longer path.
 */
function deltaCookies(header: string | null): Map<string, string> {
	let pairs = new Map<string, string>();
	for (let pair of (header ?? "").split(";")) {
		let [name = "", ...value] = pair.trim().split("=");
		if (name.startsWith(COOKIE_PREFIX) && !pairs.has(name)) pairs.set(name, value.join("="));
	}
	return pairs;
}

/**
 * Whether a request carries anything the visitor did, so its pages are drawn fresh rather
 * than from a copy cached for everyone.
 */
export function isPersonal(header: string | null): boolean {
	return deltaCookies(header).size > 0;
}

/** Decodes base64url without padding. */
function fromBase64Url(value: string): Uint8Array {
	let base64 = value.replaceAll("-", "+").replaceAll("_", "/");
	return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** Encodes bytes as base64url without padding, so the value needs no cookie quoting. */
function toBase64Url(bytes: Uint8Array): string {
	let binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** Reads a cookie's JSON, or `undefined` when it is unreadable. */
function decodeJson(value: string | undefined): unknown {
	if (!value) return undefined;
	try {
		return JSON.parse(new TextDecoder().decode(fromBase64Url(value)));
	} catch {
		return undefined;
	}
}

/** Writes JSON as a cookie value. */
function encodeJson(value: unknown): string {
	return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/** A list of short strings, or `undefined` for anything else. */
function strings(value: unknown, limit = 40): string[] | undefined {
	if (!Array.isArray(value)) return undefined;
	return value.filter((entry): entry is string => typeof entry === "string").slice(0, limit);
}

/** A record's line comments, each field checked, or `undefined`. */
function lineComments(value: unknown): LineComment[] | undefined {
	if (!Array.isArray(value)) return undefined;
	return value.flatMap((entry) => {
		if (typeof entry !== "object" || entry === null) return [];
		let { id, path, side, start, end, body, at } = entry as Record<string, unknown>;
		if (typeof id !== "string" || typeof path !== "string" || typeof body !== "string") return [];
		if (side !== "L" && side !== "R") return [];
		if (typeof start !== "number" || typeof end !== "number" || typeof at !== "number") return [];
		return [{ id, path, side, start, end, body: body.slice(0, 600), at }];
	});
}

/** Reads one record cookie, refusing anything malformed so a tampered cookie reads as no edit. */
function decodeRecord(value: string): RecordEdit | undefined {
	let raw = decodeJson(value);
	if (typeof raw !== "object" || raw === null) return undefined;
	let entry = raw as Record<string, unknown>;
	if (typeof entry.at !== "number") return undefined;
	let edit: RecordEdit = { at: entry.at };
	if (entry.state === "open" || entry.state === "closed") edit.state = entry.state;
	edit.labels = strings(entry.labels);
	edit.assignees = strings(entry.assignees);
	edit.reviewers = strings(entry.reviewers);
	edit.viewed = strings(entry.viewed, 200);
	if (entry.milestone === null || typeof entry.milestone === "string") {
		edit.milestone = entry.milestone;
	}
	let merged = entry.merged as Record<string, unknown> | undefined;
	if (
		typeof merged?.at === "number" &&
		(merged.method === "merge" || merged.method === "squash" || merged.method === "rebase")
	) {
		edit.merged = { at: merged.at, method: merged.method };
	}
	if (typeof entry.resolved === "object" && entry.resolved !== null) {
		edit.resolved = Object.fromEntries(
			Object.entries(entry.resolved).filter(
				(pair): pair is [string, boolean] => typeof pair[1] === "boolean",
			),
		);
	}
	edit.pending = lineComments(entry.pending);
	edit.posted = lineComments(entry.posted);
	let review = entry.review as Record<string, unknown> | undefined;
	if (
		typeof review?.at === "number" &&
		typeof review.body === "string" &&
		(review.kind === "comment" || review.kind === "approve" || review.kind === "changes")
	) {
		edit.review = { kind: review.kind, body: review.body.slice(0, 600), at: review.at };
	}
	return edit;
}

/** Reads the comments cookie, each field checked. */
function decodeComments(value: string | undefined): VisitorComment[] {
	let raw = decodeJson(value);
	if (!Array.isArray(raw)) return [];
	return raw.flatMap((entry) => {
		if (typeof entry !== "object" || entry === null) return [];
		let { id, number, thread, body, at } = entry as Record<string, unknown>;
		if (typeof id !== "string" || typeof number !== "number" || typeof body !== "string") return [];
		if (typeof at !== "number") return [];
		return [
			{
				id,
				number,
				thread: typeof thread === "string" ? thread : undefined,
				body: body.slice(0, 600),
				at,
			},
		];
	});
}

/**
 * Reads the visitor's state from the request's `Cookie` header.
 *
 * @param header The request's `Cookie` header.
 */
export function readState(header: string | null): VisitorState {
	let cookies = deltaCookies(header);
	let records = new Map<number, RecordEdit>();
	for (let [name, value] of cookies) {
		let match = /^delta\.n\.(\d{1,5})$/.exec(name);
		if (match === null) continue;
		let edit = decodeRecord(value);
		if (edit) records.set(Number(match[1]), edit);
	}
	return { records, comments: decodeComments(cookies.get(COMMENTS_COOKIE)) };
}

/** Builds a `Set-Cookie` value scoped to Delta's own path, which its pages, posts and frames share. */
function cookieHeader(name: string, value: string | null): string {
	let age = value === null ? 0 : COOKIE_MAX_AGE;
	return `${name}=${value ?? ""}; Path=${COOKIE_PATH}; Max-Age=${age}; SameSite=Lax; HttpOnly`;
}

/** Keeps the newest entries of a list that fit one cookie, dropping the oldest first. */
function keepNewest<Entry>(entries: Entry[], shape: (kept: Entry[]) => unknown): Entry[] {
	let kept = entries.slice(-KEPT);
	while (encodeJson(shape(kept)).length > COOKIE_BYTES && kept.length > 1) kept = kept.slice(1);
	return kept;
}

/**
 * The cookie recording an issue's or pull request's edits.
 *
 * @param number The issue or pull request.
 * @param edit Everything the visitor changed on it, as it now stands.
 */
export function recordCookie(number: number, edit: RecordEdit): string {
	let next: RecordEdit = { ...edit };
	if (next.pending) next.pending = keepNewest(next.pending, (kept) => ({ ...next, pending: kept }));
	if (next.posted) next.posted = keepNewest(next.posted, (kept) => ({ ...next, posted: kept }));
	return cookieHeader(`${COOKIE_PREFIX}n.${number}`, encodeJson(next));
}

/** The comments cookie after adding one. */
export function commentsCookie(state: VisitorState, comment: VisitorComment): string {
	let kept = keepNewest([...state.comments, comment], (list) => list);
	return cookieHeader(COMMENTS_COOKIE, encodeJson(kept));
}

/**
 * Clears every Delta cookie a request carries that records the visitor's work, which resets
 * the demo; the sidebar's width stays, since it is a preference rather than work.
 */
export function clearCookies(header: string | null): string[] {
	return [...deltaCookies(header).keys()].map((name) => cookieHeader(name, null));
}

/** The visitor's edit of one record, or a fresh one stamped now. */
export function editOf(state: VisitorState, number: number): RecordEdit {
	return { ...state.records.get(number), at: Date.now() };
}
