/**
 * Parses HTML into canonical microformats2 JSON and reads and writes that JSON, which is
 * the one shape Webmention reads a page through and Micropub sends and answers with.
 * Parsing walks the tree `@sdxc/html/document` builds, so one fetch serves every reader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { DOMDocument } from "@sdxc/html/document";
import type { Result } from "@sdxc/result";
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Schema } from "remix/data-schema";

import { parseDocument } from "@sdxc/html/document";
import { failure, isFailure, success } from "@sdxc/result";
import { parseSafe } from "remix/data-schema";

import { parseTree } from "./lib/parser.js";
import { DOCUMENT_SCHEMA, ITEM_SCHEMA as ITEM } from "./lib/schema.js";

/** Signals a source that carries no markup to parse. */
export class MicroformatsParseError extends Error {
	override name = "MicroformatsParseError";
}

/** Signals JSON that is not an mf2 item or document, carrying the data-schema issues. */
export class MicroformatsShapeError extends Error {
	override name = "MicroformatsShapeError";
	readonly issues: readonly StandardSchemaV1.Issue[];

	/**
	 * @param message - What was expected and not found
	 * @param issues - Where the value departs from the shape, empty when it is not JSON at all
	 */
	constructor(message: string, issues: readonly StandardSchemaV1.Issue[] = []) {
		super(message);
		this.issues = issues;
	}
}

/**
 * Groups the microformats2 JSON types under a single import surface.
 */
export namespace MF2 {
	/** A parsed page: every top-level item, and every `rel` the page declares. */
	export interface Document {
		items: Item[];
		/** Each rel value to the URLs carrying it, in document order. */
		rels: Record<string, string[]>;
		/** `rel-urls` on the wire. */
		relUrls: Record<string, RelUrl>;
	}

	/** One item; `type` is sorted and unique, as the parsing specification writes it. */
	export interface Item {
		type: string[];
		/** Keys are vocabulary names (`in-reply-to`), which are data, kept as spelled. */
		properties: Record<string, PropertyValue[]>;
		id?: string;
		/** The `lang` in scope where the item's root sits, when the page declares one. */
		lang?: string;
		/** Items inside this one that hold no property of it. */
		children?: Item[];
	}

	/** A property element that is also a root: the item, plus the value its property kind implies. */
	export interface NestedItem extends Item {
		value: string | Url;
		/** Present on an item in an `e-*` property, with `value` as its text. */
		html?: string;
	}

	/** A `u-*` image value that carried alternative text. */
	export interface Url {
		value: string;
		alt: string;
	}

	/** An `e-*` value: the markup as authored, URLs resolved, and its text. */
	export interface Embedded {
		html: string;
		value: string;
		lang?: string;
	}

	/** What one entry of a property's value array can be. */
	export type PropertyValue = string | Url | Embedded | NestedItem;

	/** Everything the page's links say about one URL they point at. */
	export interface RelUrl {
		/** Every rel value any link to this URL carries, unique and sorted. */
		rels: string[];
		/** The text of the first link to this URL that has any. */
		text?: string;
		title?: string;
		media?: string;
		hreflang?: string;
		type?: string;
	}

	/** Options accepted when parsing markup. */
	export interface ParseOptions {
		/** Classic microformats roots are read when a subtree carries no mf2 root. @default true */
		backcompat?: boolean;
	}
}

/**
 * Parses markup into the canonical document. `parse(source, url)` is
 * `fromDocument(parseDocument(source), url)`, failing only for a source with no markup.
 *
 * @param source - A full page or a fragment of one
 * @param baseUrl - The URL the markup was read from; `u-*` values and `e-*` markup resolve against it and `<base href>`
 * @param options - Whether classic microformats are read
 * @returns The document, or why the source has nothing to parse
 */
export function parse(
	source: string,
	baseUrl: string | URL,
	options?: MF2.ParseOptions,
): Result<MF2.Document, MicroformatsParseError> {
	let tree = parseDocument(source);
	if (isFailure(tree)) return failure(new MicroformatsParseError(tree.error.message));
	return success(fromDocument(tree.data, baseUrl, options));
}

/**
 * Reads a tree `@sdxc/html/document` already built, so one fetch serves several readers:
 * a Webmention receiver checks the link and reads the microformats of the same tree.
 *
 * @param document - The parsed page
 * @param baseUrl - The URL the page was read from
 * @param options - Whether classic microformats are read
 */
export function fromDocument(
	document: DOMDocument,
	baseUrl: string | URL,
	options?: MF2.ParseOptions,
): MF2.Document {
	return parseTree(document, baseUrl, options);
}

/**
 * Writes the canonical JSON text with wire names: a document's `relUrls` is written as
 * `rel-urls`. An item is written as it is, which is Micropub's `q=source` answer.
 */
export function stringify(value: MF2.Document | MF2.Item): string {
	if (!("items" in value)) return JSON.stringify(value);
	return JSON.stringify({ items: value.items, rels: value.rels, "rel-urls": value.relUrls });
}

/**
 * Reads canonical JSON text back into a document. `rels` and `rel-urls` may be absent,
 * as in a document another tool wrote with items alone, and read as empty.
 *
 * @returns The document, or a shape error carrying the issues (none for text that is not JSON)
 */
export function parseJSON(text: string): Result<MF2.Document, MicroformatsShapeError> {
	let decoded: unknown;
	try {
		decoded = JSON.parse(text);
	} catch {
		return failure(
			new MicroformatsShapeError("Expected JSON text, received text that is not JSON."),
		);
	}
	let result = parseSafe(DOCUMENT_SCHEMA, decoded);
	if (!result.success) {
		return failure(
			new MicroformatsShapeError("Expected a microformats2 JSON document.", result.issues),
		);
	}
	return success(result.value);
}

/**
 * Validates one mf2 item already decoded from JSON, which is a Micropub JSON create body.
 * `{ html }` content gains the `value` its markup reads as, and a nested item written
 * without a `value` takes its first `name` or `url`, so the output is always canonical.
 */
export const ITEM_SCHEMA: Schema<unknown, MF2.Item> = ITEM;

/**
 * The first item, depth-first, whose type includes `type`: each item is checked before
 * the items in its properties, and those before its `children`.
 *
 * @returns The item, or `null` when the page has none of that type
 */
export function findItem(document: MF2.Document | MF2.Item[], type: string): MF2.Item | null {
	let items = Array.isArray(document) ? document : document.items;
	for (let item of items) {
		if (item.type.includes(type)) return item;
		let nested = Object.values(item.properties)
			.flat()
			.filter((value): value is MF2.NestedItem => typeof value === "object" && "type" in value);
		let found = findItem([...nested, ...(item.children ?? [])], type);
		if (found !== null) return found;
	}
	return null;
}

/**
 * Every value of a property as plain strings: a nested item's `value`, a URL's `value`,
 * an embedded value's text. A missing property is an empty list.
 */
export function values(item: MF2.Item, property: string): string[] {
	return (item.properties[property] ?? []).map((value) => {
		if (typeof value === "string") return value;
		if (typeof value.value === "string") return value.value;
		return value.value.value;
	});
}
