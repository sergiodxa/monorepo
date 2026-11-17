/**
 * What one visitor chose on Vesper, kept in their own cookies: the profile they watch as and
 * each profile's My List. The server reads them to draw every screen, so the list and the
 * profile survive a reload and work without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoAppCookiePath } from "~/resources/views/demo-apps";

import type { Profile } from "./data";

import { DEFAULT_LIST, DEFAULT_PROFILE, PROFILES, SLUG, findProfile, findTitle } from "./data";

/** Every Vesper cookie starts with this, which is how a request is known to be personal. */
const COOKIE_PREFIX = "vesper.";

/** The cookie naming the profile the visitor watches as. */
export const PROFILE_COOKIE = `${COOKIE_PREFIX}profile`;

/** A week: long enough to come back to, short enough that the demo resets itself. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** What the visitor chose, as every screen reads it. */
export interface Viewer {
	profile: Profile;
	/** Whether the visitor picked the profile, rather than landing on the default one. */
	picked: boolean;
	/** The title ids on the profile's list, most recently added first. */
	list: string[];
}

/** The cookie holding one profile's list. */
function listCookieName(profile: string): string {
	return `${COOKIE_PREFIX}list.${profile}`;
}

/**
 * Splits a `Cookie` header into Vesper's pairs. Where a name repeats, the first wins: browsers
 * send the cookie with the longest path first, so the app's own cookie outranks an older one.
 */
function vesperCookies(header: string | null): Map<string, string> {
	let pairs = new Map<string, string>();
	for (let pair of (header ?? "").split(";")) {
		let [name = "", ...value] = pair.trim().split("=");
		if (name.startsWith(COOKIE_PREFIX) && !pairs.has(name)) pairs.set(name, value.join("="));
	}
	return pairs;
}

/**
 * Whether a request carries a choice the visitor made, so its pages render fresh rather than
 * from a copy cached for everyone.
 *
 * @param header The request's `Cookie` header.
 */
export function isPersonal(header: string | null): boolean {
	return vesperCookies(header).size > 0;
}

/**
 * Reads the visitor's profile and list. An unknown profile reads as the default one, and an
 * unknown title id in a list is dropped, so a tampered cookie can only lose entries.
 *
 * @param header The request's `Cookie` header.
 */
export function readViewer(header: string | null): Viewer {
	let cookies = vesperCookies(header);
	let picked = findProfile(cookies.get(PROFILE_COOKIE) ?? "");
	let profile = picked ?? findProfile(DEFAULT_PROFILE) ?? PROFILES[0]!;
	let stored = cookies.get(listCookieName(profile.id));
	let list =
		stored === undefined
			? defaultList(profile)
			: decodeURIComponent(stored)
					.split(",")
					.filter((id) => findTitle(id) !== undefined);
	return { profile, picked: picked !== undefined, list };
}

/** The list a profile starts with: the household's picks, or only the kids' titles on Kids. */
function defaultList(profile: Profile): string[] {
	return profile.kids ? DEFAULT_LIST.filter((id) => findTitle(id)?.kids) : DEFAULT_LIST;
}

/** One `Set-Cookie` value under the app's own path. */
function cookieHeader(name: string, value: string): string {
	return `${name}=${value}; Path=${demoAppCookiePath(SLUG)}; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`;
}

/**
 * The cookie that makes a profile the one the visitor watches as.
 *
 * @param profile The profile picked.
 */
export function profileCookie(profile: Profile): string {
	return cookieHeader(PROFILE_COOKIE, profile.id);
}

/**
 * The cookie holding a profile's list with one title added or removed. An added title goes
 * first, the way the list shows what was added last at its start.
 *
 * @param viewer The visitor as the request found them.
 * @param title The title's id.
 * @param add `true` to add it, `false` to remove it.
 */
export function listCookie(viewer: Viewer, title: string, add: boolean): string {
	let rest = viewer.list.filter((id) => id !== title);
	let next = add ? [title, ...rest] : rest;
	return cookieHeader(listCookieName(viewer.profile.id), encodeURIComponent(next.join(",")));
}
