import type { Result } from "@sdxc/result";
/**
 * Typed views of the vocabularies the IndieWeb protocols read (`h-entry`, `h-card`,
 * `h-feed`, `h-cite`) and the living algorithms built on them: authorship, the
 * representative `h-card`, Post Type Discovery, and which entry responds to a URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { StandardSchemaV1 } from "@standard-schema/spec";

import { failure, success } from "@sdxc/result";

import type { MF2 } from "./index.js";

import { MicroformatsShapeError, values } from "./index.js";

/**
 * Groups the vocabulary view types under a single import surface.
 */
export namespace Vocabulary {
	/** A person or organization, from an `h-card` or from a bare URL naming one. */
	export interface Card {
		name: string | null;
		url: string | null;
		photo: MF2.Url | null;
		/** Every `u-url`, where `url` is the first; the representative card algorithm compares them. */
		urls: string[];
		uid: string | null;
		note: string | null;
	}

	/** What a response points at, from an `h-cite` or `h-entry`, or from a bare URL. */
	export interface Cite {
		url: string | null;
		name: string | null;
		author: Card | null;
		content: MF2.Embedded | null;
		published: DateTime | null;
	}

	/** A post. Single-valued fields take the first value; list fields keep them all. */
	export interface Entry {
		name: string | null;
		summary: string | null;
		content: MF2.Embedded | null;
		published: DateTime | null;
		updated: DateTime | null;
		url: string | null;
		uid: string | null;
		/** The entry's own `author` property; {@link authorOf} runs the whole algorithm. */
		author: Card | null;
		photo: MF2.Url[];
		category: string[];
		inReplyTo: Cite[];
		likeOf: Cite[];
		repostOf: Cite[];
		bookmarkOf: Cite[];
		syndication: string[];
		rsvp: "yes" | "no" | "maybe" | "interested" | null;
	}

	/** A list of entries, which are the feed's `h-entry` children. */
	export interface Feed {
		name: string | null;
		author: Card | null;
		entries: Entry[];
	}

	/** A `dt-*` value, as written and as an instant when it names one. */
	export interface DateTime {
		value: string;
		/** `null` for a date alone or a time with no timezone, where no instant is named. */
		instant: Date | null;
	}

	/** What Post Type Discovery can say a post is, `bookmark` included. */
	export type PostType =
		| "rsvp"
		| "repost"
		| "like"
		| "reply"
		| "bookmark"
		| "photo"
		| "video"
		| "article"
		| "note";
}

/** The response properties, in the order Post Type Discovery ranks them. */
const RESPONSE_PROPERTIES = [
	["repost-of", "repost"],
	["like-of", "like"],
	["in-reply-to", "reply"],
	["bookmark-of", "bookmark"],
] as const;

/** The `rsvp` values the h-entry vocabulary defines. */
const RSVP_VALUES = new Set(["yes", "no", "maybe", "interested"]);

/** A string that is an http(s) URL, which is when a bare value names a page. */
const HTTP_URL = /^https?:\/\//iu;

/**
 * Reads an `h-entry`. Every field tolerates the shapes the vocabulary is written in: a
 * response property holding a nested `h-cite` or a bare URL, content as markup or text.
 *
 * @returns The entry, or a shape error for an item that is not an `h-entry`
 */
export function readEntry(item: MF2.Item): Result<Vocabulary.Entry, MicroformatsShapeError> {
	if (!item.type.includes("h-entry")) return failure(notA("h-entry", item));
	return success(entryOf(item));
}

/**
 * Reads an `h-card`.
 *
 * @returns The card, or a shape error for an item that is not an `h-card`
 */
export function readCard(item: MF2.Item): Result<Vocabulary.Card, MicroformatsShapeError> {
	if (!item.type.includes("h-card")) return failure(notA("h-card", item));
	return success(cardOfItem(item));
}

/**
 * Reads an `h-feed`, whose entries are its `h-entry` children in document order.
 *
 * @returns The feed, or a shape error for an item that is not an `h-feed`
 */
export function readFeed(item: MF2.Item): Result<Vocabulary.Feed, MicroformatsShapeError> {
	if (!item.type.includes("h-feed")) return failure(notA("h-feed", item));
	let entries = (item.children ?? []).filter((child) => child.type.includes("h-entry"));
	return success({
		name: first(item, "name"),
		author: cardOf(item.properties.author?.[0]),
		entries: entries.map(entryOf),
	});
}

/**
 * Reads any vocabulary through a caller's schema. The schema receives the item's
 * properties with every one-element array replaced by its element, so a vocabulary
 * that is single-valued in practice is described as it is used.
 *
 * @param item - The item to read
 * @param schema - A synchronous Standard Schema; an asynchronous one fails
 * @returns The schema's output, or a shape error carrying its issues
 */
export function readItem<Schema extends StandardSchemaV1>(
	item: MF2.Item,
	schema: Schema,
): Result<StandardSchemaV1.InferOutput<Schema>, MicroformatsShapeError> {
	let input: Record<string, unknown> = {};
	for (let [name, list] of Object.entries(item.properties)) {
		input[name] = list.length === 1 ? list[0] : list;
	}
	let result = schema["~standard"].validate(input);
	if (result instanceof Promise) {
		return failure(new MicroformatsShapeError("Expected a synchronous schema."));
	}
	if (result.issues) {
		return failure(
			new MicroformatsShapeError("The item does not match the schema.", result.issues),
		);
	}
	return success(result.value as StandardSchemaV1.InferOutput<Schema>);
}

/**
 * The author of an entry per the IndieWeb authorship algorithm: the entry's `author`,
 * then that of an `h-feed` holding it, then the page's `rel=author` when the page is the
 * entry's permalink. Authorship ending at a URL is `{ url }`, left for the caller to fetch.
 *
 * @param entry - The `h-entry` whose author is wanted
 * @param document - The page the entry was parsed from
 * @param pageUrl - The URL the page was fetched from
 */
export function authorOf(
	entry: MF2.Item,
	document: MF2.Document,
	pageUrl: string,
): Vocabulary.Card | { url: string } | null {
	let author =
		entry.properties.author?.[0] ?? feedOf(entry, document.items)?.properties.author?.[0];

	if (author !== undefined) {
		if (typeof author === "object" && "type" in author && author.type.includes("h-card")) {
			return cardOfItem(author);
		}
		let text = plain(author);
		if (HTTP_URL.test(text)) return { url: text };
		if (text !== "") return { ...emptyCard(), name: text };
	}

	let [relAuthor] = document.rels.author ?? [];
	if (relAuthor !== undefined && isPermalink(entry, document, pageUrl)) return { url: relAuthor };
	return null;
}

/**
 * The representative `h-card` of a page: the first card whose `uid` and a `url` are the
 * page, else the first with a `url` the page links with `rel=me`, else the page's only
 * card when one of its `url`s is the page.
 *
 * @param document - The parsed page
 * @param pageUrl - The URL the page was fetched from
 */
export function representativeCard(
	document: MF2.Document,
	pageUrl: string,
): Vocabulary.Card | null {
	let page = normalize(pageUrl);
	let cards = collect(document.items, "h-card").map(cardOfItem);

	let byUid = cards.find((card) => {
		return (
			card.uid !== null &&
			normalize(card.uid) === page &&
			card.urls.some((url) => normalize(url) === page)
		);
	});
	if (byUid) return byUid;

	let me = new Set((document.rels.me ?? []).map(normalize));
	let byMe = cards.find((card) => card.urls.some((url) => me.has(normalize(url))));
	if (byMe) return byMe;

	let [only] = cards;
	if (cards.length === 1 && only?.urls.some((url) => normalize(url) === page)) return only;
	return null;
}

/**
 * Post Type Discovery over an entry's explicit properties: a response type when a
 * response property is present, then `video` and `photo`, then `article` when the entry
 * has a name that its content does not start with, else `note`.
 */
export function postType(entry: MF2.Item): Vocabulary.PostType {
	let rsvp = first(entry, "rsvp")?.toLowerCase();
	if (rsvp !== undefined && RSVP_VALUES.has(rsvp)) return "rsvp";
	for (let [property, type] of RESPONSE_PROPERTIES) {
		if (hasUrl(entry, property)) return type;
	}
	if (hasUrl(entry, "video")) return "video";
	if (hasUrl(entry, "photo")) return "photo";

	let name = collapse(first(entry, "name") ?? "");
	if (name === "") return "note";
	let content = collapse(first(entry, "content") ?? first(entry, "summary") ?? "");
	return content.startsWith(name) ? "note" : "article";
}

/**
 * The entry among a page's items that responds to `target`: the first whose repost,
 * like, reply or bookmark property names it, else the first that links to it anywhere
 * else, which is a mention. URLs compare after normalization.
 *
 * @returns The entry and how it responds, or `null` when no entry links to `target`
 */
export function responseTo(
	document: MF2.Document,
	target: string,
): { entry: MF2.Item; type: "reply" | "like" | "repost" | "bookmark" | "mention" } | null {
	let goal = normalize(target);
	let entries = collect(document.items, "h-entry");

	for (let entry of entries) {
		for (let [property, type] of RESPONSE_PROPERTIES) {
			let urls = (entry.properties[property] ?? []).map(urlOf);
			if (urls.some((url) => url !== null && normalize(url) === goal)) return { entry, type };
		}
	}
	for (let entry of entries) {
		if (linksTo(entry, goal)) return { entry, type: "mention" };
	}
	return null;
}

/** Builds the entry view; the caller has checked the type. */
function entryOf(item: MF2.Item): Vocabulary.Entry {
	let rsvp = first(item, "rsvp")?.toLowerCase() ?? null;
	return {
		name: first(item, "name"),
		summary: first(item, "summary"),
		content: embeddedOf(item.properties.content?.[0]),
		published: dateTimeOf(first(item, "published")),
		updated: dateTimeOf(first(item, "updated")),
		url: firstUrl(item, "url"),
		uid: firstUrl(item, "uid"),
		author: cardOf(item.properties.author?.[0]),
		photo: (item.properties.photo ?? []).flatMap((value) => {
			let image = imageOf(value);
			return image ? [image] : [];
		}),
		category: values(item, "category"),
		inReplyTo: citesOf(item, "in-reply-to"),
		likeOf: citesOf(item, "like-of"),
		repostOf: citesOf(item, "repost-of"),
		bookmarkOf: citesOf(item, "bookmark-of"),
		syndication: (item.properties.syndication ?? []).flatMap((value) => {
			let url = urlOf(value);
			return url === null ? [] : [url];
		}),
		rsvp: rsvp !== null && RSVP_VALUES.has(rsvp) ? (rsvp as Vocabulary.Entry["rsvp"]) : null,
	};
}

/** Builds the card view of an item; the caller has checked the type. */
function cardOfItem(item: MF2.Item): Vocabulary.Card {
	let urls = (item.properties.url ?? []).flatMap((value) => {
		let url = urlOf(value);
		return url === null ? [] : [url];
	});
	let photo = item.properties.photo?.[0];
	return {
		name: first(item, "name"),
		url: urls[0] ?? null,
		photo: photo === undefined ? null : imageOf(photo),
		urls,
		uid: firstUrl(item, "uid"),
		note: first(item, "note"),
	};
}

/**
 * A card from any property value: a nested `h-card` read in full, a URL as a card with
 * only a `url`, and other text as a card with only a `name`.
 */
function cardOf(value: MF2.PropertyValue | undefined): Vocabulary.Card | null {
	if (value === undefined) return null;
	if (typeof value === "object" && "type" in value) return cardOfItem(value);
	let text = plain(value);
	if (text === "") return null;
	if (HTTP_URL.test(text)) return { ...emptyCard(), url: text, urls: [text] };
	return { ...emptyCard(), name: text };
}

/** A card with every field empty. */
function emptyCard(): Vocabulary.Card {
	return { name: null, url: null, photo: null, urls: [], uid: null, note: null };
}

/** Every value of a response property as a cite. */
function citesOf(item: MF2.Item, property: string): Vocabulary.Cite[] {
	return (item.properties[property] ?? []).map((value) => {
		if (typeof value === "object" && "type" in value) {
			return {
				url: firstUrl(value, "url") ?? urlOf(value),
				name: first(value, "name"),
				author: cardOf(value.properties.author?.[0]),
				content: embeddedOf(value.properties.content?.[0]),
				published: dateTimeOf(first(value, "published")),
			};
		}
		let text = plain(value);
		let isUrl = HTTP_URL.test(text);
		return {
			url: isUrl ? text : null,
			name: isUrl ? null : text,
			author: null,
			content: null,
			published: null,
		};
	});
}

/** A content value as embedded markup; plain text becomes its escaped markup. */
function embeddedOf(value: MF2.PropertyValue | undefined): MF2.Embedded | null {
	if (value === undefined) return null;
	if (typeof value === "string") return { html: escapeHtml(value), value };
	if ("html" in value && typeof value.html === "string") {
		let text = typeof value.value === "string" ? value.value : value.value.value;
		let embedded: MF2.Embedded = { html: value.html, value: text };
		if (value.lang !== undefined) embedded.lang = value.lang;
		return embedded;
	}
	let text = plain(value);
	return { html: escapeHtml(text), value: text };
}

/** An image value: a URL gains an empty `alt`, a nested item gives its `value`. */
function imageOf(value: MF2.PropertyValue): MF2.Url | null {
	if (typeof value === "string") return { value, alt: "" };
	if ("alt" in value && typeof value.alt === "string" && !("type" in value)) return value;
	if ("type" in value && typeof value.value === "object") return value.value;
	let url = urlOf(value);
	return url === null ? null : { value: url, alt: "" };
}

/**
 * A `dt-*` value with the instant it names: a date, a time and a timezone, in the
 * normalized form (`2026-09-23 10:15:00-0300`) or ISO 8601.
 */
function dateTimeOf(value: string | null): Vocabulary.DateTime | null {
	if (value === null) return null;
	let match =
		/^(\d{4}-\d{2}-\d{2})[Tt ](\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|z|[+-]\d{2}(?::?\d{2})?)$/u.exec(
			value.trim(),
		);
	if (!match) return { value, instant: null };
	let [, date = "", time = "", zone = ""] = match;
	let offset = zone.toUpperCase() === "Z" ? "Z" : normalizeOffset(zone);
	let [hour = "", ...rest] = time.split(":");
	let instant = new Date(`${date}T${[hour.padStart(2, "0"), ...rest].join(":")}${offset}`);
	return { value, instant: Number.isNaN(instant.getTime()) ? null : instant };
}

/** `±HH`, `±HHMM` or `±HH:MM` as the `±HH:MM` a `Date` reads. */
function normalizeOffset(zone: string): string {
	let digits = zone.slice(1).replace(":", "");
	return `${zone[0]}${digits.slice(0, 2)}:${digits.slice(2, 4) || "00"}`;
}

/** The first value of a property as text, or `null`. */
function first(item: MF2.Item, property: string): string | null {
	return values(item, property)[0] ?? null;
}

/** The first URL a property holds, or `null`. */
function firstUrl(item: MF2.Item, property: string): string | null {
	let value = item.properties[property]?.[0];
	return value === undefined ? null : urlOf(value);
}

/**
 * The URL a value names: the string itself, an image's URL, a nested item's first
 * `url` or its `value`. Embedded markup names none.
 */
function urlOf(value: MF2.PropertyValue): string | null {
	if (typeof value === "string") return value;
	if ("type" in value) {
		let [url] = value.properties.url ?? [];
		if (url !== undefined && (typeof url === "string" || !("html" in url))) return plain(url);
		return plain(value);
	}
	if ("html" in value) return null;
	return value.value;
}

/** Whether a property holds a non-empty URL. */
function hasUrl(item: MF2.Item, property: string): boolean {
	return (item.properties[property] ?? []).some((value) => {
		let url = urlOf(value);
		return url !== null && url !== "";
	});
}

/** A value as text: a nested item's or URL's `value`, an embedded value's text. */
function plain(value: MF2.PropertyValue): string {
	if (typeof value === "string") return value;
	if (typeof value.value === "string") return value.value;
	return value.value.value;
}

/** Every item of a type, depth-first through properties and children. */
function collect(items: MF2.Item[], type: string): MF2.Item[] {
	let found: MF2.Item[] = [];
	let visit = (item: MF2.Item) => {
		if (item.type.includes(type)) found.push(item);
		for (let list of Object.values(item.properties)) {
			for (let value of list) {
				if (typeof value === "object" && "type" in value) visit(value);
			}
		}
		for (let child of item.children ?? []) visit(child);
	};
	for (let item of items) visit(item);
	return found;
}

/** The `h-feed` holding an entry among its children, searched through the whole page. */
function feedOf(entry: MF2.Item, items: MF2.Item[]): MF2.Item | null {
	for (let feed of collect(items, "h-feed")) {
		if (feed.children?.includes(entry)) return feed;
	}
	return null;
}

/**
 * Whether the page is the entry's permalink: the entry's `url` or `uid` is the page, or
 * it is the page's only `h-entry`.
 */
function isPermalink(entry: MF2.Item, document: MF2.Document, pageUrl: string): boolean {
	let page = normalize(pageUrl);
	let own = [...values(entry, "url"), ...values(entry, "uid")];
	if (own.some((url) => normalize(url) === page)) return true;
	return collect(document.items, "h-entry").length === 1;
}

/** Whether any value of an entry, or a link in its markup, is the normalized target. */
function linksTo(entry: MF2.Item, target: string): boolean {
	for (let list of Object.values(entry.properties)) {
		for (let value of list) {
			if (typeof value === "object" && "html" in value && typeof value.html === "string") {
				for (let match of value.html.matchAll(/\bhref="([^"]*)"/gu)) {
					if (normalize(decodeEntities(match[1] ?? "")) === target) return true;
				}
				continue;
			}
			let url = urlOf(value);
			if (url !== null && normalize(url) === target) return true;
		}
	}
	return false;
}

/** A URL in the form two spellings of it compare equal in; other text as written. */
function normalize(url: string): string {
	try {
		return new URL(url).href;
	} catch {
		return url;
	}
}

/** Collapses runs of whitespace and trims, which is how Post Type Discovery compares text. */
function collapse(text: string): string {
	return text.replace(/\s+/gu, " ").trim();
}

/** Escapes text for use as markup. */
function escapeHtml(text: string): string {
	return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Reverses the escaping the serializer applies to attribute values. */
function decodeEntities(text: string): string {
	return text.replaceAll("&quot;", '"').replaceAll("&nbsp;", " ").replaceAll("&amp;", "&");
}

/** The error an item of the wrong type reads as. */
function notA(type: string, item: MF2.Item): MicroformatsShapeError {
	return new MicroformatsShapeError(
		`Expected an ${type}, received ${item.type.join(" ") || "an untyped item"}.`,
	);
}
