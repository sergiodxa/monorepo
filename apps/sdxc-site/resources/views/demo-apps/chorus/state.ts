/**
 * What one visitor did on Chorus, kept in their own cookies: each like, repost, save, follow
 * and vote in a cookie of its own, so two quick presses never overwrite each other, and the
 * visitor's posts and replies in one more. The server reads them to draw every count.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Person, Post } from "~/resources/views/demo-apps/chorus/data";

import { demoAppCookiePath } from "~/resources/views/demo-apps";
import {
	ARRIVED_POSTS,
	EVERYONE,
	ME,
	NOW,
	POSTS,
	findPerson,
} from "~/resources/views/demo-apps/chorus/data";

/** Every Chorus cookie starts with this, which is how a request is known to be personal. */
export const COOKIE_PREFIX = "chorus.";

/** The path every Chorus cookie is sent under. */
const COOKIE_PATH = demoAppCookiePath("chorus");

/** The cookie holding the visitor's own posts and replies. */
export const POSTS_COOKIE = `${COOKIE_PREFIX}posts`;

/** The cookie holding the messages the visitor sent. */
export const MESSAGES_COOKIE = `${COOKIE_PREFIX}messages`;

/** How many of the visitor's posts are kept; the oldest goes first, so the cookie stays small. */
export const KEPT_POSTS = 8;

/** A week: long enough to come back to, short enough that the demo resets itself. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** The toggles a visitor flips on a post or a person, each its own cookie family. */
export type ToggleKind = "like" | "repost" | "save" | "follow";

/** One post the visitor wrote. `at` is when, in epoch milliseconds. */
export interface VisitorPost {
	id: string;
	text: string;
	at: number;
	replyTo?: string;
	quote?: string;
	/** For a message, the handle it was sent to. */
	to?: string;
}

/** Everything the visitor changed, keyed by post id or handle. */
export interface VisitorState {
	toggles: Record<ToggleKind, Map<string, boolean>>;
	votes: Map<string, number>;
	posts: VisitorPost[];
	/** The messages the visitor sent, oldest first. */
	messages: VisitorPost[];
}

/** A post as one visitor sees it: their likes, reposts, saves and vote counted in. */
export interface PostView extends Post {
	liked: boolean;
	reposted: boolean;
	saved: boolean;
	/** Written by the visitor in this browser. */
	fresh: boolean;
	person: Person;
}

/**
 * Splits a `Cookie` header into its pairs, keeping only Chorus's.
 *
 * @param header The request's `Cookie` header.
 * @returns Each Chorus cookie's value by name.
 */
function chorusCookies(header: string | null): Map<string, string> {
	let pairs = new Map<string, string>();
	for (let pair of (header ?? "").split(";")) {
		let [name = "", ...value] = pair.trim().split("=");
		if (name.startsWith(COOKIE_PREFIX)) pairs.set(name, value.join("="));
	}
	return pairs;
}

/**
 * Whether a request carries anything the visitor did, so its pages are drawn fresh rather
 * than from a copy cached for everyone.
 *
 * @param header The request's `Cookie` header.
 * @returns `true` when any Chorus cookie is present.
 */
export function isPersonal(header: string | null): boolean {
	return chorusCookies(header).size > 0;
}

/**
 * Reads the visitor's state. An unreadable posts cookie reads as no posts, so a tampered
 * cookie costs the visitor their drafts and nothing else.
 *
 * @param header The request's `Cookie` header.
 * @returns The visitor's toggles, votes and posts.
 */
export function readState(header: string | null): VisitorState {
	let state: VisitorState = {
		toggles: { like: new Map(), repost: new Map(), save: new Map(), follow: new Map() },
		votes: new Map(),
		posts: [],
		messages: [],
	};
	for (let [name, value] of chorusCookies(header)) {
		let [kind = "", ...rest] = name.slice(COOKIE_PREFIX.length).split(".");
		let key = rest.join(".");
		if (kind === "vote" && /^\d$/.test(value)) state.votes.set(key, Number(value));
		else if (isToggleKind(kind) && (value === "1" || value === "0")) {
			state.toggles[kind].set(key, value === "1");
		}
	}
	let cookies = chorusCookies(header);
	state.posts = decodePosts(cookies.get(POSTS_COOKIE));
	state.messages = decodePosts(cookies.get(MESSAGES_COOKIE)).filter((message) => message.to);
	return state;
}

/** Narrows a cookie family name to a toggle kind. */
function isToggleKind(kind: string): kind is ToggleKind {
	return kind === "like" || kind === "repost" || kind === "save" || kind === "follow";
}

/**
 * Reads the posts cookie: base64url JSON of short keys, each entry checked field by field.
 *
 * @param value The cookie's value.
 * @returns The visitor's posts, oldest first.
 */
function decodePosts(value: string | undefined): VisitorPost[] {
	if (value === undefined || value === "") return [];
	let parsed: unknown;
	try {
		parsed = JSON.parse(new TextDecoder().decode(fromBase64Url(value)));
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];
	return parsed.flatMap((entry: unknown) => {
		if (typeof entry !== "object" || entry === null) return [];
		let { i, t, a, r, q, w } = entry as Record<string, unknown>;
		if (typeof i !== "string" || typeof t !== "string" || typeof a !== "number") return [];
		return [
			{
				id: i,
				text: t,
				at: a,
				replyTo: typeof r === "string" ? r : undefined,
				quote: typeof q === "string" ? q : undefined,
				to: typeof w === "string" ? w : undefined,
			},
		];
	});
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

/**
 * Builds a `Set-Cookie` header for a Chorus cookie, scoped to Chorus's own path, which its pages,
 * posts and frames share.
 *
 * @param name The cookie's full name.
 * @param value Its value; `null` clears it.
 * @returns The header's value.
 */
export function cookieHeader(name: string, value: string | null): string {
	let age = value === null ? 0 : COOKIE_MAX_AGE;
	return `${name}=${value ?? ""}; Path=${COOKIE_PATH}; Max-Age=${age}; SameSite=Lax; HttpOnly`;
}

/**
 * Expires a cookie at `/demo`, where earlier versions of the demo wrote it, so Reset also clears
 * what a returning visitor's browser still sends from there.
 */
function legacyCookieHeader(name: string): string {
	return `${name}=; Path=/demo; Max-Age=0; SameSite=Lax; HttpOnly`;
}

/**
 * The cookie recording one toggle.
 *
 * @param kind What was toggled.
 * @param key The post id or handle.
 * @param on Its new state.
 * @returns The `Set-Cookie` value.
 */
export function toggleCookie(kind: ToggleKind, key: string, on: boolean): string {
	return cookieHeader(`${COOKIE_PREFIX}${kind}.${key}`, on ? "1" : "0");
}

/**
 * The cookie recording a poll vote.
 *
 * @param post The poll's post id.
 * @param option The chosen option's index.
 * @returns The `Set-Cookie` value.
 */
export function voteCookie(post: string, option: number): string {
	return cookieHeader(`${COOKIE_PREFIX}vote.${post}`, String(option));
}

/**
 * The posts cookie after adding one post, keeping the newest {@link KEPT_POSTS}.
 *
 * @param state The visitor's current state.
 * @param post The new post.
 * @returns The `Set-Cookie` value.
 */
export function postsCookie(state: VisitorState, post: VisitorPost): string {
	return cookieHeader(POSTS_COOKIE, keepNewest([...state.posts, post]));
}

/**
 * The messages cookie after sending one more, keeping the newest {@link KEPT_POSTS}.
 *
 * @param state The visitor's current state.
 * @param message The message sent.
 * @returns The `Set-Cookie` value.
 */
export function messagesCookie(state: VisitorState, message: VisitorPost): string {
	return cookieHeader(MESSAGES_COOKIE, keepNewest([...state.messages, message]));
}

/** Encodes the newest entries that fit one cookie, dropping the oldest first. */
function keepNewest(entries: VisitorPost[]): string {
	let kept = entries.slice(-KEPT_POSTS);
	let value = encodePosts(kept);
	while (value.length > POSTS_COOKIE_BYTES && kept.length > 1) {
		kept = kept.slice(1);
		value = encodePosts(kept);
	}
	return value;
}

/** The most the posts cookie's value may weigh, under a browser's 4 KB per cookie. */
const POSTS_COOKIE_BYTES = 3600;

/** Encodes posts as base64url JSON with one-letter keys. */
function encodePosts(posts: VisitorPost[]): string {
	let json = JSON.stringify(
		posts.map((entry) => ({
			i: entry.id,
			t: entry.text,
			a: entry.at,
			r: entry.replyTo,
			q: entry.quote,
			w: entry.to,
		})),
	);
	return toBase64Url(new TextEncoder().encode(json));
}

/**
 * Clears every Chorus cookie a request carries, which resets the demo.
 *
 * @param header The request's `Cookie` header.
 * @returns One clearing `Set-Cookie` value per cookie.
 */
export function clearCookies(header: string | null): string[] {
	return [...chorusCookies(header).keys()].flatMap((name) => [
		cookieHeader(name, null),
		legacyCookieHeader(name),
	]);
}

/**
 * A visitor's post as a post, written by Noor with no reactions yet.
 *
 * @param post The visitor's post.
 * @returns The post with its counts at zero.
 */
function asPost(post: VisitorPost): Post {
	return {
		id: post.id,
		author: ME.handle,
		text: post.text,
		at: new Date(post.at).toISOString(),
		replyTo: post.replyTo,
		quote: post.quote,
		replies: 0,
		reposts: 0,
		likes: 0,
		views: 0,
	};
}

/**
 * Finds a post among the fixtures, the arrivals and the visitor's own.
 *
 * @param id The post's id.
 * @param state The visitor's state.
 * @returns The post, or `undefined` when nothing has that id.
 */
export function lookupPost(id: string, state: VisitorState): Post | undefined {
	let fixture =
		POSTS.find((post) => post.id === id) ?? ARRIVED_POSTS.find((post) => post.id === id);
	if (fixture) return fixture;
	let own = state.posts.find((post) => post.id === id);
	return own ? asPost(own) : undefined;
}

/**
 * Whether a toggle is on for the visitor: their change when they made one, else Noor's.
 *
 * @param state The visitor's state.
 * @param kind The toggle.
 * @param key The post id or handle.
 * @param fallback Noor's state before the visitor changed anything.
 */
export function isOn(
	state: VisitorState,
	kind: ToggleKind,
	key: string,
	fallback: boolean,
): boolean {
	return state.toggles[kind].get(key) ?? fallback;
}

/**
 * Whether the visitor follows a person.
 *
 * @param state The visitor's state.
 * @param person The person.
 */
export function follows(state: VisitorState, person: Person): boolean {
	return isOn(state, "follow", person.handle, person.followed);
}

/**
 * A person's follower count with the visitor's follow counted in.
 *
 * @param state The visitor's state.
 * @param person The person.
 */
export function followerCount(state: VisitorState, person: Person): number {
	return person.followers + Number(follows(state, person)) - Number(person.followed);
}

/**
 * How many people Noor follows, with the visitor's follows and unfollows counted in.
 *
 * @param state The visitor's state.
 */
export function followingCount(state: VisitorState): number {
	let change = EVERYONE.reduce(
		(total, person) => total + Number(follows(state, person)) - Number(person.followed),
		0,
	);
	return ME.following + change;
}

/**
 * The visitor's view of a post: their toggles applied to its flags and counts, and the
 * replies they wrote to it counted.
 *
 * @param post The post.
 * @param state The visitor's state.
 * @returns The post as the visitor sees it.
 */
export function viewPost(post: Post, state: VisitorState): PostView {
	let liked = isOn(state, "like", post.id, post.liked ?? false);
	let reposted = isOn(state, "repost", post.id, post.reposted ?? false);
	let saved = isOn(state, "save", post.id, post.saved ?? false);
	let voted = state.votes.get(post.id) ?? post.voted;
	let replies = state.posts.filter((entry) => entry.replyTo === post.id).length;
	return {
		...post,
		liked,
		reposted,
		saved,
		voted,
		likes: post.likes + Number(liked) - Number(post.liked ?? false),
		reposts: post.reposts + Number(reposted) - Number(post.reposted ?? false),
		replies: post.replies + replies,
		poll: post.poll && pollWithVote(post, voted),
		fresh: state.posts.some((entry) => entry.id === post.id),
		person: findPerson(post.author) ?? ME,
	};
}

/** A poll with the visitor's vote added to its option's tally, unless Noor's fixture vote is it. */
function pollWithVote(post: Post, voted: number | undefined): Post["poll"] {
	if (!post.poll) return undefined;
	if (voted === undefined || voted === post.voted) return post.poll;
	return {
		...post.poll,
		votes: post.poll.votes.map((count, index) => count + Number(index === voted)),
	};
}

/**
 * Milliseconds since a post was written: fixtures against the fixed {@link NOW}, the
 * visitor's posts against the real clock, so both read as recent.
 *
 * @param post The post viewed.
 * @param now The real clock, in epoch milliseconds.
 */
export function ageOf(post: PostView, now: number): number {
	let reference = post.fresh ? now : Date.parse(NOW);
	return Math.max(0, reference - Date.parse(post.at));
}
