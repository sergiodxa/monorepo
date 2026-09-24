/**
 * The data-schema description of canonical microformats2 JSON: an item, each of the four
 * shapes a property value takes, and a whole document with its wire name `rel-urls`,
 * read into the camelCase document the parser produces.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Schema } from "remix/data-schema";

import { parseDocument } from "@sdxc/html/document";
import { isFailure } from "@sdxc/result";
import { array, object, optional, record, string, union } from "remix/data-schema";
import { lazy } from "remix/data-schema/lazy";

import type { MF2 } from "../index.js";

import { trimSpaces } from "./tree.js";

/** `{ value, alt }`, an image URL with its alternative text. */
const URL_SCHEMA: Schema<unknown, MF2.Url> = object({ value: string(), alt: string() }).transform(
	({ value, alt }) => ({ value, alt }),
);

/**
 * `{ html, value }`. A Micropub client may send `{ html }` alone, so a missing `value`
 * is read from the markup's text, which is what a parser would have produced for it.
 */
const EMBEDDED_SCHEMA: Schema<unknown, MF2.Embedded> = object({
	html: string(),
	value: optional(string()),
	lang: optional(string()),
}).transform(({ html, value, lang }) => {
	let embedded: MF2.Embedded = { html, value: value ?? textOfMarkup(html) };
	if (lang !== undefined) embedded.lang = lang;
	return embedded;
});

/** The fields every item has, nested or top-level. */
const ITEM_FIELDS = {
	type: array(string()),
	properties: record(
		string(),
		array(lazy((): Schema<unknown, MF2.PropertyValue> => PROPERTY_VALUE_SCHEMA)),
	),
	id: optional(string()),
	lang: optional(string()),
	children: optional(array(lazy((): Schema<unknown, MF2.Item> => ITEM_SCHEMA))),
};

/**
 * An item sitting in a property. A nested item written without a `value`, which
 * Micropub clients send for an embedded `h-card`, takes its first `name`, then its first
 * `url`, the value a parser would have given it.
 */
const NESTED_ITEM_SCHEMA: Schema<unknown, MF2.NestedItem> = object({
	...ITEM_FIELDS,
	value: optional(union([string(), URL_SCHEMA])),
	html: optional(string()),
}).transform(({ value, html, ...fields }) => {
	let item = toItem(fields);
	let nested: MF2.NestedItem = { ...item, value: value ?? impliedValue(item) };
	if (html !== undefined) nested.html = html;
	return nested;
});

/** A property value: a string, or the first object shape it matches, nested items first. */
const PROPERTY_VALUE_SCHEMA: Schema<unknown, MF2.PropertyValue> = union([
	string(),
	NESTED_ITEM_SCHEMA,
	EMBEDDED_SCHEMA,
	URL_SCHEMA,
]);

/** One microformats2 item, the shape a Micropub JSON create body carries. */
export const ITEM_SCHEMA: Schema<unknown, MF2.Item> = object(ITEM_FIELDS).transform(toItem);

/** A whole document as written on the wire, `rels` and `rel-urls` optional. */
export const DOCUMENT_SCHEMA: Schema<unknown, MF2.Document> = object({
	items: array(ITEM_SCHEMA),
	rels: optional(record(string(), array(string()))),
	"rel-urls": optional(
		record(
			string(),
			object({
				rels: array(string()),
				text: optional(string()),
				title: optional(string()),
				media: optional(string()),
				hreflang: optional(string()),
				type: optional(string()),
			}),
		),
	),
}).transform(({ items, rels, "rel-urls": relUrls }) => {
	let urls: Record<string, MF2.RelUrl> = {};
	for (let [url, entry] of Object.entries(relUrls ?? {})) urls[url] = withoutUndefined(entry);
	return { items, rels: rels ?? {}, relUrls: urls };
});

/** The fields shared by every item, validated, as an item with no `undefined` members. */
interface ItemFields {
	type: string[];
	properties: Record<string, MF2.PropertyValue[]>;
	id?: string | undefined;
	lang?: string | undefined;
	children?: MF2.Item[] | undefined;
}

/** Builds an item, leaving out optional members that were absent. */
function toItem({ type, properties, id, lang, children }: ItemFields): MF2.Item {
	let item: MF2.Item = { type, properties };
	if (id !== undefined) item.id = id;
	if (lang !== undefined) item.lang = lang;
	if (children !== undefined) item.children = children;
	return item;
}

/** The first string `name`, then the first string `url`, else empty. */
function impliedValue(item: MF2.Item): string {
	for (let property of ["name", "url"]) {
		let [first] = item.properties[property] ?? [];
		if (typeof first === "string") return first;
	}
	return "";
}

/** The text a parser would read from markup, trimmed. */
function textOfMarkup(html: string): string {
	let parsed = parseDocument(html);
	if (isFailure(parsed)) return "";
	return trimSpaces(parsed.data.body.textContent ?? "");
}

/** Copies an object, dropping members whose value is `undefined`. */
function withoutUndefined<T extends object>(
	value: T,
): { [K in keyof T]: Exclude<T[K], undefined> } {
	return Object.fromEntries(Object.entries(value).filter(([, member]) => member !== undefined)) as {
		[K in keyof T]: Exclude<T[K], undefined>;
	};
}
