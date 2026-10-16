/**
 * What a page's social card says and where it is served from. The card route reads the
 * text from the rendered page's own microformats — a post's `h-entry`, a listing's `h-feed`
 * and its first entries — so a card always says what the page publishes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MF2 } from "@sdxc/microformats";

import { findItem, parse, values } from "@sdxc/microformats";
import { isFailure } from "@sdxc/result";

import { isPublicTypePath, kindAt, POST_KINDS } from "~/app/models/kinds";
import { PROFILE } from "~/config/profile";

export namespace SocialCard {
	/** Which page a card is for, and a version that changes whenever the card's text would. */
	export interface Reference {
		/** The page's path, `/` for the home page. */
		path: string;
		version: string;
	}

	/** One row of a listing's card, as the listing shows it. */
	export interface Entry {
		title: string;
		/** The short date the listing prints, `Oct 02, 26`. */
		date: string;
	}

	/** A post's card: what kind of post, its title and summary, and who wrote it when. */
	export interface Post {
		kind: "post";
		eyebrow: string;
		title: string;
		description: string;
		/** `By Sergio Xalambrí · October 2, 2026`, or the author alone for an undated page. */
		byline: string;
		url: string;
	}

	/** A listing's card: its heading and summary over the newest entries. */
	export interface Listing {
		kind: "listing";
		title: string;
		description: string;
		entries: Entry[];
		url: string;
	}

	export type Content = Post | Listing;
}

/** The size social platforms render a large card at. */
export const SOCIAL_CARD_SIZE = { width: 1200, height: 630 } as const;

/**
 * Names the card design. Changing the drawing changes this, which changes every storage
 * key, so storage holds the new design with no purge.
 */
export const SOCIAL_CARD_TEMPLATE = "1";

/** How many of a listing's newest entries its card shows. */
export const LISTING_ENTRIES = 3;

/** Where the image route lives; a page's path follows it. */
const ROUTE_PREFIX = "/social";

/** The segment the home page's card is stored under, since `/` leaves no name for a file. */
const HOME_SEGMENT = "index";

/** The listing's short date, `Oct 02, 26`, read in UTC so the server's zone never shifts it. */
const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "2-digit",
	year: "2-digit",
	timeZone: "UTC",
});

/** A post's full date, `October 2, 2026`, read in UTC. */
const LONG_DATE = new Intl.DateTimeFormat("en-US", {
	month: "long",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});

/**
 * The absolute URL a page advertises as its `og:image`. The version in the query makes a
 * platform that caches images per URL fetch the card again after the page changes.
 */
export function socialCardUrl(reference: SocialCard.Reference): string {
	let segment = reference.path === "/" ? `/${HOME_SEGMENT}` : reference.path.replace(/\/$/, "");
	return new URL(`${ROUTE_PREFIX}${segment}.png?v=${reference.version}`, PROFILE.canonical.origin)
		.href;
}

/** The page path a card route's `path` parameter stands for. */
export function pagePathFromCardPath(path: string): string {
	return path === HOME_SEGMENT ? "/" : `/${path}`;
}

/** Where a rendered card is stored: one object per template and content, never rewritten. */
export function socialCardKey(content: SocialCard.Content): string {
	return `${SOCIAL_CARD_TEMPLATE}/${socialCardVersion(JSON.stringify(content))}.png`;
}

/**
 * A short, stable fingerprint of the given parts. It only has to tell one card's text from
 * another's, so a fast synchronous 53-bit hash (cyrb53) is enough, and a view can compute it
 * while rendering.
 */
export function socialCardVersion(...parts: Array<string | null | undefined>): string {
	let input = [SOCIAL_CARD_TEMPLATE, ...parts.map((part) => part ?? "")].join("\u0000");
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let index = 0; index < input.length; index++) {
		let code = input.charCodeAt(index);
		h1 = Math.imul(h1 ^ code, 2654435761);
		h2 = Math.imul(h2 ^ code, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Reads a rendered page's card from its microformats, or `null` when the page publishes
 * neither a feed nor an entry. A listing's `h-feed` wins over the entries inside it; a
 * post's title comes from its `og:title`, since a note's entry has no name of its own.
 *
 * @param html - The page as the router rendered it
 * @param path - The page's path, which names a post's kind and sets the card's address
 */
export function readSocialCard(html: string, path: string): SocialCard.Content | null {
	let url = new URL(path, PROFILE.canonical.origin);
	let document = parse(html, url);
	if (isFailure(document)) return null;
	let description = metaContent(html, "name", "description") ?? "";
	let address = `${url.host}${path === "/" ? "" : path}`;

	let feed = findItem(document.data, "h-feed");
	if (feed) {
		let entries = (feed.children ?? [])
			.filter((item) => item.type.includes("h-entry"))
			.slice(0, LISTING_ENTRIES)
			.map((item) => ({
				title: firstValue(item, "name"),
				date: formatDate(firstValue(item, "published"), SHORT_DATE),
			}))
			.filter((entry) => entry.title !== "");
		return {
			kind: "listing",
			title: firstValue(feed, "name") || PROFILE.name,
			description,
			entries,
			url: address,
		};
	}

	let entry = findItem(document.data, "h-entry");
	if (!entry) return null;
	let title = metaContent(html, "property", "og:title") ?? firstValue(entry, "name");
	let date = formatDate(firstValue(entry, "published"), LONG_DATE);
	let segment = path.split("/")[1];
	let eyebrow = isPublicTypePath(segment) ? POST_KINDS[kindAt(segment)].label : "Post";
	return {
		kind: "post",
		eyebrow,
		title,
		description,
		byline: date ? `By ${PROFILE.name} · ${date}` : `By ${PROFILE.name}`,
		url: address,
	};
}

/** A property's first value, trimmed, or an empty string when the item lacks it. */
function firstValue(item: MF2.Item, property: string): string {
	return values(item, property)[0]?.trim() ?? "";
}

/** Formats an ISO date, or returns an empty string for a missing or unreadable one. */
function formatDate(value: string, format: Intl.DateTimeFormat): string {
	let time = Date.parse(value);
	return Number.isNaN(time) ? "" : format.format(time);
}

/** The decoded `content` of the `<meta>` whose `attribute` is `name`, or `null`. */
function metaContent(html: string, attribute: "name" | "property", name: string): string | null {
	for (let match of html.matchAll(/<meta\b[^>]*>/g)) {
		let tag = match[0];
		if (readAttribute(tag, attribute) !== name) continue;
		return readAttribute(tag, "content");
	}
	return null;
}

/** One attribute's decoded value in a tag, quoted either way, or `null`. */
function readAttribute(tag: string, name: string): string | null {
	let value = new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`).exec(tag);
	if (!value) return null;
	return decodeEntities(value[1] ?? value[2] ?? "");
}

/** The named references an attribute value can carry. */
const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
};

/** Decodes the character references an HTML serializer writes into attribute values. */
function decodeEntities(value: string): string {
	return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, entity: string) => {
		let lower = entity.toLowerCase();
		if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
		if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
		return NAMED_ENTITIES[lower] ?? whole;
	});
}
