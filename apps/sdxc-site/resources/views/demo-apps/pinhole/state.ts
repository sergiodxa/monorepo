/**
 * What one visitor did on Pinhole, kept in their own cookies: each like, save, follow and
 * comment like in a cookie of its own, so two quick taps never overwrite each other, and the
 * comments they wrote in one more. The server reads them to draw every count and button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoAppCookiePath } from "~/resources/views/demo-apps";

import type { Comment, Person, Post, Reel } from "./data";

import { ME_HANDLE, SLUG, findPost } from "./data";

/** Every Pinhole cookie starts with this, which is how a request is known to be personal. */
const COOKIE_PREFIX = "pinhole.";

/** The cookie holding the comments the visitor wrote. */
const COMMENTS_COOKIE = `${COOKIE_PREFIX}comments`;

/** How many of the visitor's comments are kept; the oldest goes first, so the cookie stays small. */
export const KEPT_COMMENTS = 10;

/** The longest comment kept, in characters. */
export const COMMENT_LIMIT = 300;

/** A week: long enough to come back to, short enough that the demo resets itself. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** The toggles a visitor flips, each its own cookie family keyed by a post, reel, person or comment. */
export type ToggleKind = "like" | "save" | "follow" | "clike";

/** One comment the visitor wrote. `at` is when, in epoch milliseconds. */
export interface VisitorComment {
	id: string;
	post: string;
	text: string;
	at: number;
}

/** Everything the visitor changed. */
export interface VisitorState {
	toggles: Record<ToggleKind, Map<string, boolean>>;
	comments: VisitorComment[];
}

/** Splits a `Cookie` header into Pinhole's pairs; where a name repeats, the first (longest path) wins. */
function pinholeCookies(header: string | null): Map<string, string> {
	let pairs = new Map<string, string>();
	for (let pair of (header ?? "").split(";")) {
		let [name = "", ...value] = pair.trim().split("=");
		if (name.startsWith(COOKIE_PREFIX) && !pairs.has(name)) pairs.set(name, value.join("="));
	}
	return pairs;
}

/**
 * Whether a request carries anything the visitor did, so its pages render fresh rather than
 * from a copy cached for everyone.
 *
 * @param header The request's `Cookie` header.
 */
export function isPersonal(header: string | null): boolean {
	return pinholeCookies(header).size > 0;
}

/** Narrows a cookie family name to a toggle kind. */
function isToggleKind(kind: string): kind is ToggleKind {
	return kind === "like" || kind === "save" || kind === "follow" || kind === "clike";
}

/**
 * Reads the visitor's state. A toggle cookie holding anything but `1` or `0` is ignored, and an
 * unreadable comments cookie reads as none, so a tampered cookie only loses what it held.
 *
 * @param header The request's `Cookie` header.
 */
export function readState(header: string | null): VisitorState {
	let state: VisitorState = {
		toggles: { like: new Map(), save: new Map(), follow: new Map(), clike: new Map() },
		comments: [],
	};
	let cookies = pinholeCookies(header);
	for (let [name, value] of cookies) {
		let [kind = "", ...rest] = name.slice(COOKIE_PREFIX.length).split(".");
		if (isToggleKind(kind) && (value === "1" || value === "0")) {
			state.toggles[kind].set(rest.join("."), value === "1");
		}
	}
	state.comments = decodeComments(cookies.get(COMMENTS_COOKIE));
	return state;
}

/**
 * Reads the comments cookie: base64url JSON, each entry checked field by field and dropped when
 * its post no longer exists.
 */
function decodeComments(value: string | undefined): VisitorComment[] {
	if (value === undefined || value === "") return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(value)));
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];
	return parsed.flatMap((entry: unknown) => {
		if (typeof entry !== "object" || entry === null) return [];
		let { at, id, post, text } = entry as Record<string, unknown>;
		if (typeof id !== "string" || typeof post !== "string" || typeof text !== "string") return [];
		if (typeof at !== "number" || findPost(post) === undefined) return [];
		return [{ id, post, text: text.slice(0, COMMENT_LIMIT), at }];
	});
}

/** Decodes base64url text into bytes. */
function base64UrlToBytes(value: string): Uint8Array {
	let base64 = value.replaceAll("-", "+").replaceAll("_", "/");
	return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/** Encodes text as base64url, which a cookie value carries without quoting. */
function toBase64Url(text: string): string {
	let binary = "";
	for (let byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

/** One `Set-Cookie` value under the app's own path. */
function cookieHeader(name: string, value: string, maxAge = COOKIE_MAX_AGE): string {
	return `${name}=${value}; Path=${demoAppCookiePath(SLUG)}; Max-Age=${maxAge}; SameSite=Lax; HttpOnly`;
}

/**
 * The cookie recording one toggle.
 *
 * @param kind What was toggled.
 * @param key The post or reel id, handle or comment id.
 * @param on Its new state.
 */
export function toggleCookie(kind: ToggleKind, key: string, on: boolean): string {
	return cookieHeader(`${COOKIE_PREFIX}${kind}.${key}`, on ? "1" : "0");
}

/**
 * The comments cookie with one more comment, keeping the newest {@link KEPT_COMMENTS}.
 *
 * @param state The visitor as the request found them.
 * @param comment The new comment.
 */
export function commentsCookie(state: VisitorState, comment: VisitorComment): string {
	let kept = [...state.comments, comment].slice(-KEPT_COMMENTS);
	return cookieHeader(COMMENTS_COOKIE, toBase64Url(JSON.stringify(kept)));
}

/**
 * The cookies that put the demo back as it started: every Pinhole cookie the request carries, expired.
 *
 * @param header The request's `Cookie` header.
 */
export function resetCookies(header: string | null): string[] {
	return [...pinholeCookies(header).keys()].map((name) => cookieHeader(name, "", 0));
}

/** Whether the visitor likes a post or reel now. */
export function isLiked(state: VisitorState, id: string): boolean {
	return state.toggles.like.get(id) ?? false;
}

/** Whether the visitor saved a post now. */
export function isSaved(state: VisitorState, id: string): boolean {
	return state.toggles.save.get(id) ?? false;
}

/** Whether the visitor follows a person now, starting from who they followed before any tap. */
export function isFollowing(state: VisitorState, person: Person): boolean {
	return state.toggles.follow.get(person.handle) ?? person.followed;
}

/** A post's like count with the visitor's like counted in. */
export function likeCount(state: VisitorState, item: Post | Reel): number {
	return item.likes + (isLiked(state, item.id) ? 1 : 0);
}

/** A person's follower count with the visitor's follow counted in. */
export function followerCount(state: VisitorState, person: Person): number {
	let delta = Number(isFollowing(state, person)) - Number(person.followed);
	return person.followers + delta;
}

/** A comment as the visitor sees it: its likes with theirs counted in, and whether it is theirs and new. */
export interface CommentView extends Comment {
	liked: boolean;
	fresh: boolean;
}

/**
 * A post's comments, the post's own oldest first and then the visitor's, each with its likes.
 *
 * @param state The visitor's state.
 * @param post The post.
 */
export function commentsOf(state: VisitorState, post: Post): CommentView[] {
	let own = state.comments
		.filter((comment) => comment.post === post.id)
		.map((comment) => ({
			id: comment.id,
			author: ME_HANDLE,
			text: comment.text,
			ago: Math.max(0, (Date.now() - comment.at) / 60_000),
			likes: 0,
			fresh: true,
		}));
	return [...post.comments.map((comment) => ({ ...comment, fresh: false })), ...own].map(
		(comment) => {
			let liked = state.toggles.clike.get(comment.id) ?? false;
			return { ...comment, liked, likes: comment.likes + (liked ? 1 : 0) };
		},
	);
}

/** The post ids the visitor saved, in the order the posts were published. */
export function savedPosts(state: VisitorState): string[] {
	return [...state.toggles.save].filter(([, on]) => on).map(([id]) => id);
}
