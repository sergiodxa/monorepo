/**
 * Atom 1.0 feed parser and builder. Reads a document into the `Atom` class and
 * serializes it back, keeping every link, text construct and foreign element the
 * source carried so a consumer decides what matters rather than the parser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import { buildDocument } from "./lib/build-document.js";
import { cloneEntry, cloneFeed } from "./lib/clone.js";
import { parseDocument } from "./lib/parse-feed.js";
import { validateEntry } from "./lib/validate-entry.js";
import { validateFeed } from "./lib/validate-feed.js";

/** Raised when a document is not a usable Atom feed. */
export class AtomParseError extends Error {
	override name = "AtomParseError";
}

/** Raised when a feed cannot be retrieved or does not arrive as XML. */
export class AtomFetchError extends Error {
	override name = "AtomFetchError";
}

/** Raised when in-memory feed data cannot be serialized to XML. */
export class AtomStringifyError extends Error {
	override name = "AtomStringifyError";
}

export namespace Atom {
	/** A foreign element, preserved verbatim so unknown modules round-trip. */
	export interface Element {
		name: string;
		attributes?: Record<string, string>;
		children?: Node[];
	}

	/** A child of a foreign element: either text or another element. */
	export type Node = string | Element;

	/** How a text construct's payload should be read (RFC 4287 §3.1). */
	export type TextType = "text" | "html" | "xhtml";

	/**
	 * A human-readable text construct. `value` is always a string: an `xhtml`
	 * construct arrives as the serialized markup its wrapper contained, so a
	 * consumer never walks a second tree to read a title.
	 */
	export interface Text {
		value: string;
		type?: TextType;
	}

	/** A text construct, or the bare string form when it carries no type. */
	export type TextInput = string | Text;

	/** A person construct: an author or a contributor (RFC 4287 §3.2). */
	export interface Person {
		name: string;
		uri?: string;
		email?: string;
		extensions?: Element[];
	}

	/** One person, or several. */
	export type PersonInput = Person | Person[];

	/**
	 * A reference away from the feed or entry. `rel` is left as the document
	 * spelled it, absent included, because the default is a reader's concern.
	 */
	export interface Link {
		href: string;
		rel?: string;
		type?: string;
		hreflang?: string;
		title?: string;
		length?: number;
		attributes?: Record<string, string>;
		extensions?: Element[];
	}

	/** One link, or several. */
	export type LinkInput = Link | Link[];

	/** A category, with the scheme that gives its term meaning. */
	export interface Category {
		term: string;
		scheme?: string;
		label?: string;
		attributes?: Record<string, string>;
		extensions?: Element[];
	}

	/** A category, or the bare term when it carries nothing else. */
	export type CategoryInput = string | Category;

	/** The agent that produced the feed. */
	export interface Generator {
		value: string;
		uri?: string;
		version?: string;
	}

	/**
	 * An entry's body. A superset of a text construct: `type` may be any media
	 * type, and `src` points at content held out of line, in which case the
	 * element itself is empty and `value` is absent.
	 */
	export interface Content {
		type?: string;
		src?: string;
		value?: string;
		attributes?: Record<string, string>;
	}

	/** Metadata of the feed an entry was copied from (RFC 4287 §4.2.11). */
	export interface Source {
		id?: string;
		title?: TextInput;
		updated?: string;
		subtitle?: TextInput;
		author?: PersonInput;
		link?: LinkInput;
		rights?: TextInput;
		attributes?: Record<string, string>;
		extensions?: Element[];
	}

	/** Feed-level metadata. `updated` stays the raw RFC 3339 text the source held. */
	export interface Feed {
		id: string;
		title: TextInput;
		updated: string;
		subtitle?: TextInput;
		rights?: TextInput;
		author?: PersonInput;
		contributor?: PersonInput;
		link?: LinkInput;
		category?: CategoryInput | CategoryInput[];
		generator?: Generator;
		icon?: string;
		logo?: string;
		/** `xml:lang` on the feed element, inherited by everything inside it. */
		lang?: string;
		/** `xml:base` on the feed element, against which its references resolved. */
		base?: string;
		namespaces?: Record<string, string>;
		attributes?: Record<string, string>;
		extensions?: Element[];
	}

	/** One entry. `updated` is required by RFC 4287 §4.1.2; `published` is not. */
	export interface Entry {
		id: string;
		title: TextInput;
		updated: string;
		published?: string;
		summary?: TextInput;
		content?: Content;
		author?: PersonInput;
		contributor?: PersonInput;
		link?: LinkInput;
		category?: CategoryInput | CategoryInput[];
		rights?: TextInput;
		source?: Source;
		lang?: string;
		base?: string;
		attributes?: Record<string, string>;
		extensions?: Element[];
	}

	/** A whole document: the feed's metadata and its entries. */
	export interface Document {
		feed: Feed;
		entries: Entry[];
	}
}

/**
 * An Atom 1.0 feed, holding feed-level metadata and an ordered list of entries.
 *
 * Reading accessors hand back clones, so a caller cannot reach into the instance
 * by mutating what it returned.
 */
export class Atom {
	#feed: Atom.Feed;
	#entries: Atom.Entry[] = [];

	/**
	 * Builds a feed from its metadata, starting with no entries.
	 *
	 * @param feed - The feed-level metadata
	 * @throws AtomParseError When `id`, `title` or `updated` is missing
	 */
	constructor(feed: Atom.Feed) {
		validateFeed(feed);
		this.#feed = cloneFeed(feed);
	}

	/** The feed-level metadata. */
	get feed(): Atom.Feed {
		return cloneFeed(this.#feed);
	}

	/**
	 * Replaces the feed-level metadata, leaving the entries in place.
	 *
	 * @throws AtomParseError When `id`, `title` or `updated` is missing
	 */
	set feed(feed: Atom.Feed) {
		validateFeed(feed);
		this.#feed = cloneFeed(feed);
	}

	/** The entries, in the order they were added. */
	get entries(): Atom.Entry[] {
		return this.#entries.map(cloneEntry);
	}

	/**
	 * Appends one entry.
	 *
	 * @param entry - The entry to append
	 * @throws AtomParseError When `id`, `title` or `updated` is missing
	 */
	addEntry(entry: Atom.Entry): void {
		validateEntry(entry);
		this.#entries.push(cloneEntry(entry));
	}

	/**
	 * Removes the first entry carrying an id, which RFC 4287 makes unique within
	 * a feed, so at most one entry can match.
	 *
	 * @param id - The entry id to remove
	 */
	removeEntry(id: string): void {
		let index = this.#entries.findIndex((entry) => entry.id === id);
		if (index === -1) return;
		this.#entries.splice(index, 1);
	}

	/** The feed and its entries as plain, serializable data. */
	toJSON(): Atom.Document {
		return { feed: cloneFeed(this.#feed), entries: this.#entries.map(cloneEntry) };
	}

	/**
	 * Serializes the feed into Atom 1.0 XML.
	 *
	 * @throws AtomStringifyError When the data cannot form a valid document
	 */
	toString(): string {
		let result = XML.stringify(new XML(buildDocument(this.#feed, this.#entries)));
		if (isFailure(result)) throw new AtomStringifyError(result.error.message);
		return result.data;
	}

	/**
	 * Reads a feed out of an already-parsed XML document, which is the entry
	 * point for a caller that parsed the text for some other purpose first.
	 *
	 * @param xml - The parsed XML document
	 * @param base - Document URI, used to resolve references the feed leaves relative
	 * @returns The feed, or the reason the document is not one
	 */
	static fromXML(xml: XML, base?: string): Result<Atom, AtomParseError> {
		let document = parseDocument(xml, base);
		if (isFailure(document)) return document;

		let atom = new Atom(document.data.feed);
		for (let entry of document.data.entries) atom.addEntry(entry);
		return success(atom);
	}

	/**
	 * Parses Atom XML text.
	 *
	 * @param source - The raw XML text
	 * @param base - Document URI, used to resolve references the feed leaves relative
	 * @returns The feed, or the reason the text is not one
	 */
	static parse(source: string, base?: string): Result<Atom, AtomParseError> {
		let parsed = XML.parse(source);
		if (isFailure(parsed)) return failure(new AtomParseError(parsed.error.message));
		return Atom.fromXML(parsed.data, base);
	}

	/**
	 * Retrieves a feed and parses it.
	 *
	 * References the feed leaves relative resolve against the URL the response
	 * finally came from, so a redirected feed still yields absolute links.
	 *
	 * @param input - The URL or request to retrieve
	 * @param init - Additional request options
	 * @returns The feed, or the reason it could not be read
	 */
	static async fetch(
		input: URL | RequestInfo,
		init?: RequestInit,
	): Promise<Result<Atom, AtomFetchError | AtomParseError>> {
		let response: Response;
		try {
			response = await fetch(input, init);
		} catch (error) {
			return failure(new AtomFetchError(`Failed to fetch Atom feed: ${message(error)}`));
		}

		if (!response.ok) {
			return failure(new AtomFetchError(`Failed to fetch Atom feed: ${response.status}`));
		}

		let text = await response.text();
		return Atom.parse(text, response.url || undefined);
	}
}

/**
 * Reads a thrown value's message, so a rejected request reports what went wrong
 * whether or not it rejected with an `Error`.
 */
function message(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
