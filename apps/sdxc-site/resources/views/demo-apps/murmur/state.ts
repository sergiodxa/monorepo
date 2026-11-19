/**
 * What one listener did on Murmur, kept in their own cookies: liked tracks, saved albums and
 * playlists, followed artists, and what was last playing. The server reads them to draw every
 * screen, so a reload and a visit without script show the same library and player.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoAppCookiePath } from "~/resources/views/demo-apps";

import {
	DEFAULT_FOLLOWED,
	DEFAULT_LIKED,
	DEFAULT_SAVED,
	SLUG,
	findAlbum,
	findArtist,
	findPlaylist,
	findTrack,
} from "./data";

/** Every Murmur cookie starts with this, which is how a request is known to be personal. */
const COOKIE_PREFIX = "murmur.";

/** The cookie naming the track last played and the list it played from; script writes it too. */
export const NOW_COOKIE = `${COOKIE_PREFIX}now`;

/** A week: long enough to come back to, short enough that the demo resets itself. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** The cookies holding each kind of list, by what they hold. */
const LIST_COOKIES = {
	liked: `${COOKIE_PREFIX}liked`,
	saved: `${COOKIE_PREFIX}saved`,
	followed: `${COOKIE_PREFIX}followed`,
} as const;

/** What plays, as the player and the server both name it. */
export interface NowPlaying {
	/**
	 * The list it plays from: `album:<id>`, `playlist:<id>`, `artist:<id>`, `liked` or
	 * `track:<id>` for one track on its own.
	 */
	context: string;
	track: string;
}

/** What the listener has done, as every screen reads it. */
export interface Listener {
	/** Track ids, most recently liked first. */
	liked: string[];
	/** `album:<id>` and `playlist:<id>` keys, most recently saved first. */
	saved: string[];
	/** Artist ids, most recently followed first. */
	followed: string[];
	now: NowPlaying | null;
}

/**
 * Splits a `Cookie` header into Murmur's pairs. Where a name repeats, the first wins: browsers
 * send the cookie with the longest path first, so the app's own cookie outranks an older one.
 */
function murmurCookies(header: string | null): Map<string, string> {
	let pairs = new Map<string, string>();
	for (let pair of (header ?? "").split(";")) {
		let [name = "", ...value] = pair.trim().split("=");
		if (name.startsWith(COOKIE_PREFIX) && !pairs.has(name)) pairs.set(name, value.join("="));
	}
	return pairs;
}

/**
 * Whether a request carries something the listener did, so its pages render fresh rather
 * than from a copy cached for everyone.
 *
 * @param header The request's `Cookie` header.
 */
export function isPersonal(header: string | null): boolean {
	return murmurCookies(header).size > 0;
}

/**
 * Whether a list key names something in the catalogue, so a tampered cookie only loses entries.
 *
 * @param key A saved key, such as `album:tidelight`.
 */
function isSavable(key: string): boolean {
	let [kind, id = ""] = key.split(":");
	if (kind === "album") return findAlbum(id) !== undefined;
	if (kind === "playlist") return findPlaylist(id) !== undefined;
	return false;
}

/**
 * Whether a context names a list the player can play.
 *
 * @param context Such as `playlist:night-drive` or `liked`.
 */
export function isContext(context: string): boolean {
	if (context === "liked") return true;
	let [kind, id = ""] = context.split(":");
	if (kind === "artist") return findArtist(id) !== undefined;
	if (kind === "track") return findTrack(id) !== undefined;
	return isSavable(context);
}

/**
 * Reads a `now` cookie's value, `<context>|<track>`, dropping one that names nothing playable.
 *
 * @param value The cookie's value, still encoded.
 */
export function parseNowPlaying(value: string | undefined): NowPlaying | null {
	if (value === undefined) return null;
	let [context = "", track = ""] = decodeURIComponent(value).split("|");
	if (!isContext(context) || findTrack(track) === undefined) return null;
	return { context, track };
}

/**
 * Reads the listener's library and player. A list cookie that is missing reads as the
 * starting library, so a first visit already has something to browse.
 *
 * @param header The request's `Cookie` header.
 */
export function readListener(header: string | null): Listener {
	let cookies = murmurCookies(header);

	/** The ids a list cookie holds, or the starting ones, each checked against the catalogue. */
	let list = (name: string, fallback: string[], valid: (id: string) => boolean) => {
		let stored = cookies.get(name);
		let ids = stored === undefined ? fallback : decodeURIComponent(stored).split(",");
		return ids.filter((id) => id !== "" && valid(id));
	};

	return {
		liked: list(LIST_COOKIES.liked, DEFAULT_LIKED, (id) => findTrack(id) !== undefined),
		saved: list(LIST_COOKIES.saved, DEFAULT_SAVED, isSavable),
		followed: list(LIST_COOKIES.followed, DEFAULT_FOLLOWED, (id) => findArtist(id) !== undefined),
		now: parseNowPlaying(cookies.get(NOW_COOKIE)),
	};
}

/** One `Set-Cookie` value under the app's own path; script may read and write it. */
function cookieHeader(name: string, value: string): string {
	return `${name}=${value}; Path=${demoAppCookiePath(SLUG)}; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * The cookie value for what plays, as the server sets it and the player writes it.
 *
 * @param now The track and its list.
 */
export function nowPlayingValue(now: NowPlaying): string {
	return encodeURIComponent(`${now.context}|${now.track}`);
}

/**
 * The cookie that makes a track the one in the player.
 *
 * @param now The track and its list.
 */
export function nowCookie(now: NowPlaying): string {
	return cookieHeader(NOW_COOKIE, nowPlayingValue(now));
}

/**
 * The cookie holding one of the listener's lists with an entry added at its start or removed.
 *
 * @param listener The listener as the request found them.
 * @param kind Which list.
 * @param id The entry.
 * @param add `true` to add it, `false` to remove it.
 */
export function listCookie(
	listener: Listener,
	kind: keyof typeof LIST_COOKIES,
	id: string,
	add: boolean,
): string {
	let rest = listener[kind].filter((entry) => entry !== id);
	let next = add ? [id, ...rest] : rest;
	return cookieHeader(LIST_COOKIES[kind], encodeURIComponent(next.join(",")));
}

/**
 * The cookies that put the demo back as it started: every Murmur cookie the request carries,
 * expired.
 *
 * @param header The request's `Cookie` header.
 */
export function resetCookies(header: string | null): string[] {
	return [...murmurCookies(header).keys()].map(
		(name) => `${name}=; Path=${demoAppCookiePath(SLUG)}; Max-Age=0; SameSite=Lax`,
	);
}
