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
		/**
		 * The document lists every entry of the feed (`fh:complete`, RFC 5005 §2), so an
		 * entry missing from it has left the feed.
		 */
		complete?: boolean;
		/**
		 * The document is an archive (`fh:archive`, RFC 5005 §4): a fixed page of older
		 * entries reached through `prev-archive`, never the one to subscribe to.
		 */
		archive?: boolean;
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
 * Every way in validates what RFC 4287 requires, so an instance always holds a
 * feed that serializes; reading accessors hand back clones the caller may mutate.
 */
export class Atom {
	#feed: Atom.Feed;
	#entries: Atom.Entry[];

	/** Takes ownership of already-validated data, so callers pass clones. */
	private constructor(feed: Atom.Feed, entries: Atom.Entry[]) {
		this.#feed = feed;
		this.#entries = entries;
	}

	/** The feed-level metadata. */
	get feed(): Atom.Feed {
		return cloneFeed(this.#feed);
	}

	/** The entries, in the order they were added. */
	get entries(): Atom.Entry[] {
		return this.#entries.map(cloneEntry);
	}

	/**
	 * Replaces the feed-level metadata, leaving the entries in place. A refused
	 * feed leaves the instance unchanged.
	 *
	 * @param feed - The new feed-level metadata
	 * @returns An error naming the first of `id`, `title` or `updated` that is missing
	 */
	setFeed(feed: Atom.Feed): Result<void, AtomParseError> {
		let valid = validateFeed(feed);
		if (isFailure(valid)) return valid;
		this.#feed = cloneFeed(feed);
		return success(undefined);
	}

	/**
	 * Appends one entry. A refused entry leaves the instance unchanged.
	 *
	 * @param entry - The entry to append
	 * @returns An error naming the first of `id`, `title` or `updated` that is missing
	 */
	addEntry(entry: Atom.Entry): Result<void, AtomParseError> {
		let valid = validateEntry(entry);
		if (isFailure(valid)) return valid;
		this.#entries.push(cloneEntry(entry));
		return success(undefined);
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
	 * Builds a feed from plain data, the shape `toJSON` returns.
	 *
	 * @param document - The feed-level metadata and its entries, in order
	 * @returns The feed, or an error naming the first required element missing from
	 * the feed or an entry
	 * @example Atom.fromJSON({ feed: { id, title, updated }, entries: [] })
	 */
	static fromJSON(document: Atom.Document): Result<Atom, AtomParseError> {
		let feed = validateFeed(document.feed);
		if (isFailure(feed)) return feed;

		for (let entry of document.entries) {
			let valid = validateEntry(entry);
			if (isFailure(valid)) return valid;
		}

		return success(new Atom(cloneFeed(document.feed), document.entries.map(cloneEntry)));
	}

	/**
	 * Serializes a feed into Atom 1.0 XML with the Atom namespace as the default.
	 * Plain data is validated first, so one call builds and writes a feed.
	 *
	 * @param input - A feed instance, or the plain data `Atom.fromJSON` accepts
	 * @returns The XML text, an `AtomParseError` when plain data lacks a required
	 * element, or an `AtomStringifyError` when a name or value cannot be written as XML
	 * @example Atom.stringify({ feed: { id, title, updated }, entries })
	 */
	static stringify(
		input: Atom | Atom.Document,
	): Result<string, AtomParseError | AtomStringifyError> {
		let atom = input instanceof Atom ? success(input) : Atom.fromJSON(input);
		if (isFailure(atom)) return atom;

		let result = XML.stringify(new XML(buildDocument(atom.data.#feed, atom.data.#entries)));
		if (isFailure(result)) return failure(new AtomStringifyError(result.error.message));
		return result;
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
		return success(new Atom(document.data.feed, document.data.entries));
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
