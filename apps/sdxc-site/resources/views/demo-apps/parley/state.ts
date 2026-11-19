/**
 * What one visitor did in Parley, kept in their own cookies: the messages they sent, the ones
 * they edited, deleted or pinned, their reactions, where they last read each conversation, and
 * how many live lines and answers they have already seen, so a reload keeps them all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoAppCookiePath } from "~/resources/views/demo-apps";
import { SLUG } from "~/resources/views/demo-apps/parley/data";

/** Every Parley cookie starts with this, which is how a request is known to be personal. */
const COOKIE_PREFIX = "parley.";

/** The path every Parley cookie is sent under. */
const COOKIE_PATH = demoAppCookiePath(SLUG);

/** A week: long enough to come back to, short enough that the demo resets itself. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** How many sent messages are kept; the oldest goes first, so the cookie stays small. */
const KEPT_MESSAGES = 14;

/** The longest message a cookie keeps, in characters. */
export const MESSAGE_LIMIT = 600;

/** Each concern's own cookie, so writing one never rewrites another. */
const COOKIES = {
	sent: `${COOKIE_PREFIX}sent`,
	edits: `${COOKIE_PREFIX}edits`,
	deleted: `${COOKIE_PREFIX}deleted`,
	reactions: `${COOKIE_PREFIX}reactions`,
	pins: `${COOKIE_PREFIX}pins`,
	read: `${COOKIE_PREFIX}read`,
	live: `${COOKIE_PREFIX}live`,
} as const;

/** A file the visitor attached, by name and size. */
export interface SentFile {
	name: string;
	size: number;
}

/** One message the visitor sent. */
export interface SentMessage {
	id: string;
	/** The conversation's key. */
	key: string;
	text: string;
	/** When, in epoch milliseconds. */
	at: number;
	/** The message it replies to in a thread. */
	parent?: string;
	files?: SentFile[];
	/** Whether a teammate has answered it, so the answer renders below it. */
	answered?: boolean;
}

/** Everything the visitor changed. */
export interface VisitorState {
	sent: SentMessage[];
	/** New text by message id. */
	edits: Record<string, string>;
	deleted: string[];
	/** The visitor's own reaction toggles by message id and emoji: `true` added, `false` removed. */
	reactions: Record<string, Record<string, boolean>>;
	/** Pins the visitor changed by message id. */
	pins: Record<string, boolean>;
	/** When the visitor last read each conversation, in epoch milliseconds, by key. */
	read: Record<string, number>;
	/** When the visitor saw each live line arrive, in epoch milliseconds, by conversation key. */
	live: Record<string, number[]>;
}

/**
 * Splits a `Cookie` header into Parley's pairs. Where a name repeats, the first wins: browsers
 * send the cookie with the longest path first, so the app's own outranks an older one.
 */
function parleyCookies(header: string | null): Map<string, string> {
	let pairs = new Map<string, string>();
	for (let pair of (header ?? "").split(";")) {
		let [name = "", ...value] = pair.trim().split("=");
		if (name.startsWith(COOKIE_PREFIX) && !pairs.has(name)) pairs.set(name, value.join("="));
	}
	return pairs;
}

/**
 * Whether a request carries anything the visitor did, so its pages are drawn fresh rather than
 * from a copy cached for everyone.
 *
 * @param header The request's `Cookie` header.
 */
export function isPersonal(header: string | null): boolean {
	return parleyCookies(header).size > 0;
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

/** Reads a cookie's base64url JSON, or `undefined` when it is missing or unreadable. */
function decode(value: string | undefined): unknown {
	if (value === undefined || value === "") return undefined;
	try {
		return JSON.parse(new TextDecoder().decode(fromBase64Url(value)));
	} catch {
		return undefined;
	}
}

/** Writes a value as base64url JSON. */
function encode(value: unknown): string {
	return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

/** Whether a value is a plain object. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Keeps the entries of a record whose values pass a check. */
function recordOf<T>(value: unknown, check: (entry: unknown) => entry is T): Record<string, T> {
	if (!isRecord(value)) return {};
	let kept: Record<string, T> = {};
	for (let [key, entry] of Object.entries(value)) if (check(entry)) kept[key] = entry;
	return kept;
}

/** Whether a value is a string. */
function isString(value: unknown): value is string {
	return typeof value === "string";
}

/** Whether a value is a finite number. */
function isNumber(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value);
}

/** Whether a value is a boolean. */
function isBoolean(value: unknown): value is boolean {
	return typeof value === "boolean";
}

/** Whether a value is a list of epoch milliseconds. */
function isTimes(value: unknown): value is number[] {
	return Array.isArray(value) && value.every(isNumber);
}

/** Whether a value is a record of booleans, one visitor's toggles on one message. */
function isToggles(value: unknown): value is Record<string, boolean> {
	return isRecord(value) && Object.values(value).every(isBoolean);
}

/** Reads the sent cookie's short keys, each entry checked field by field. */
function decodeSent(value: unknown): SentMessage[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((entry: unknown) => {
		if (!isRecord(entry)) return [];
		let { i, k, t, a, p, f, d } = entry;
		if (!isString(i) || !isString(k) || !isString(t) || !isNumber(a)) return [];
		let files = Array.isArray(f)
			? f.flatMap((file: unknown) =>
					isRecord(file) && isString(file.n) && isNumber(file.s)
						? [{ name: file.n, size: file.s }]
						: [],
				)
			: undefined;
		return [
			{
				id: i,
				key: k,
				text: t,
				at: a,
				parent: isString(p) ? p : undefined,
				files: files && files.length > 0 ? files : undefined,
				answered: d === 1,
			},
		];
	});
}

/**
 * Reads the visitor's state. An unreadable cookie reads as nothing done, so a tampered value
 * costs the visitor that one concern and nothing else.
 *
 * @param header The request's `Cookie` header.
 */
export function readState(header: string | null): VisitorState {
	let cookies = parleyCookies(header);
	let deleted = decode(cookies.get(COOKIES.deleted));
	return {
		sent: decodeSent(decode(cookies.get(COOKIES.sent))),
		edits: recordOf(decode(cookies.get(COOKIES.edits)), isString),
		deleted: Array.isArray(deleted) ? deleted.filter(isString) : [],
		reactions: recordOf(decode(cookies.get(COOKIES.reactions)), isToggles),
		pins: recordOf(decode(cookies.get(COOKIES.pins)), isBoolean),
		read: recordOf(decode(cookies.get(COOKIES.read)), isNumber),
		live: recordOf(decode(cookies.get(COOKIES.live)), isTimes),
	};
}

/** Builds a `Set-Cookie` header scoped to Parley's own path. `null` clears it. */
function cookieHeader(name: string, value: string | null): string {
	let age = value === null ? 0 : COOKIE_MAX_AGE;
	return `${name}=${value ?? ""}; Path=${COOKIE_PATH}; Max-Age=${age}; SameSite=Lax; HttpOnly`;
}

/**
 * The cookie holding the visitor's sent messages with `messages` written, the newest
 * {@link KEPT_MESSAGES} kept.
 */
export function sentCookie(messages: SentMessage[]): string {
	let kept = messages.slice(-KEPT_MESSAGES).map((message) => ({
		i: message.id,
		k: message.key,
		t: message.text.slice(0, MESSAGE_LIMIT),
		a: message.at,
		...(message.parent === undefined ? {} : { p: message.parent }),
		...(message.files === undefined
			? {}
			: {
					f: message.files.slice(0, 4).map((file) => ({ n: file.name.slice(0, 80), s: file.size })),
				}),
		...(message.answered ? { d: 1 } : {}),
	}));
	return cookieHeader(COOKIES.sent, encode(kept));
}

/** The cookie holding the visitor's edits. */
export function editsCookie(edits: Record<string, string>): string {
	return cookieHeader(COOKIES.edits, encode(edits));
}

/** The cookie holding the ids the visitor deleted. */
export function deletedCookie(deleted: string[]): string {
	return cookieHeader(COOKIES.deleted, encode(deleted.slice(-30)));
}

/** The cookie holding the visitor's reaction toggles. */
export function reactionsCookie(reactions: Record<string, Record<string, boolean>>): string {
	return cookieHeader(COOKIES.reactions, encode(reactions));
}

/** The cookie holding the pins the visitor changed. */
export function pinsCookie(pins: Record<string, boolean>): string {
	return cookieHeader(COOKIES.pins, encode(pins));
}

/** The cookie holding when the visitor last read each conversation. */
export function readCookie(read: Record<string, number>): string {
	return cookieHeader(COOKIES.read, encode(read));
}

/** The cookie holding when the visitor saw each live line arrive. */
export function liveCookie(live: Record<string, number[]>): string {
	return cookieHeader(COOKIES.live, encode(live));
}

/**
 * Clears every Parley cookie the request carries, for Reset.
 *
 * @param header The request's `Cookie` header.
 */
export function clearCookies(header: string | null): string[] {
	return [...parleyCookies(header).keys()].map((name) => cookieHeader(name, null));
}
