/**
 * Provides the XML class and error types for parsing, traversing, and
 * serializing XML documents.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import { cloneDeclaration } from "./lib/clone-declaration.js";
import { cloneElement } from "./lib/clone-element.js";
import { parseDocument } from "./lib/parse-document.js";
import { stringifyDocument } from "./lib/stringify-document.js";
import {
	collectInElement,
	findInElement,
	normalizePath,
	queryFromElements,
	startsWithRoot,
} from "./lib/traversal.js";

/**
 * Signals that XML source could not be converted into the package tree format.
 */
export class XMLParseError extends Error {
	override name = "XMLParseError";
}

/**
 * Signals that an XML tree could not be serialized into a valid XML string.
 */
export class XMLStringifyError extends Error {
	override name = "XMLStringifyError";
}

/**
 * Groups the public XML types under a single import surface.
 */
export namespace XML {
	/**
	 * Stores XML declaration attributes that should appear before the root element.
	 */
	export interface Declaration {
		version?: string;
		encoding?: string;
		standalone?: "yes" | "no";
	}

	/**
	 * Stores one XML element with its raw tag name, attributes, and ordered children.
	 */
	export interface Element {
		name: string;
		attributes?: Record<string, string>;
		children?: Node[];
	}

	/**
	 * Represents either a text node or a nested XML element.
	 */
	export type Node = string | Element;

	/**
	 * Stores a parsed XML document with the declaration and single root element.
	 */
	export interface Document {
		declaration?: Declaration;
		root: Element;
	}

	/**
	 * Accepts either a full XML document or a single root element for serialization.
	 */
	export type Input = Document | Element;

	/**
	 * Checks one element while traversing an XML tree.
	 */
	export type Predicate = (element: Element) => boolean;
}

/**
 * Wraps one parsed XML document and provides traversal and serialization helpers.
 */
export class XML {
	#declaration?: XML.Declaration;
	#root: XML.Element;

	/**
	 * Stores one XML document instance around a declaration and root element.
	 *
	 * @param document - The plain XML document data to wrap
	 */
	constructor(document: XML.Document) {
		this.#declaration = cloneDeclaration(document.declaration);
		this.#root = cloneElement(document.root);
	}

	/**
	 * Parses XML into an `XML` instance.
	 *
	 * @param source - Raw XML text to parse
	 * @returns A Result containing an `XML` instance or a parse error
	 */
	static parse(source: string): Result<XML, XMLParseError> {
		let result = parseDocument(source);
		if (result.status === "failure") return failure(new XMLParseError(result.error.message));
		return success(new XML(result.data));
	}

	/**
	 * Serializes an XML instance, plain document data, or a root element into XML text.
	 *
	 * @param input - The XML instance, document data, or root element to serialize
	 * @returns A Result containing the XML string or a serialization error
	 */
	static stringify(input: XML | XML.Input): Result<string, XMLStringifyError> {
		let document = toDocument(input);
		if (document.status === "failure") return document;

		let result = stringifyDocument(document.data);
		if (result.status === "failure") {
			return failure(new XMLStringifyError(result.error.message));
		}

		return result;
	}

	/**
	 * Exposes the XML declaration as cloned data so callers cannot mutate internals.
	 */
	get declaration(): XML.Declaration | undefined {
		return cloneDeclaration(this.#declaration);
	}

	/**
	 * Exposes the root element as cloned data so callers cannot mutate internals.
	 */
	get root(): XML.Element {
		return cloneElement(this.#root);
	}

	/**
	 * Returns the wrapped XML document as plain serializable data.
	 */
	toJSON(): XML.Document {
		return {
			declaration: cloneDeclaration(this.#declaration),
			root: cloneElement(this.#root),
		};
	}

	/**
	 * Serializes the current XML instance into a string.
	 */
	toString(): string {
		let result = stringifyDocument(this.toJSON());
		if (result.status === "failure") throw new XMLStringifyError(result.error.message);
		return result.data;
	}

	/**
	 * Returns the first element in the document tree that matches the predicate.
	 *
	 * @param predicate - Receives each visited element in depth-first order
	 * @returns The first matching element, if one exists
	 */
	find(predicate: XML.Predicate): XML.Element | undefined {
		return findInElement(this.#root, predicate);
	}

	/**
	 * Returns every element in the document tree that matches the predicate.
	 *
	 * @param predicate - Receives each visited element in depth-first order
	 * @returns All matching elements in traversal order
	 */
	findAll(predicate: XML.Predicate): XML.Element[] {
		let matches: XML.Element[] = [];
		collectInElement(this.#root, predicate, matches);
		return matches;
	}

	/**
	 * Resolves the first element that matches a simple `/`-delimited path.
	 *
	 * @param path - Path such as `channel/item/title` or `rss/channel`
	 * @returns The first matching element, if one exists
	 */
	query(path: string): XML.Element | undefined {
		return this.queryAll(path).at(0);
	}

	/**
	 * Resolves all elements that match a simple `/`-delimited path.
	 *
	 * @param path - Path such as `channel/item/title` or `rss/channel`
	 * @returns All matching elements in document order
	 */
	queryAll(path: string): XML.Element[] {
		let segments = normalizePath(path);
		if (segments.length === 0) return [];

		let roots = startsWithRoot(segments, this.#root.name)
			? queryFromElements([this.#root], segments.slice(1))
			: queryFromElements([this.#root], segments);

		return roots.map(cloneElement);
	}
}

/**
 * Recognizes the element shape, which is what tells a bare root element apart from
 * the document that holds one, and what a value arriving from JavaScript is checked
 * against before anything reads a name off it.
 */
function isElement(value: unknown): value is XML.Element {
	if (typeof value !== "object" || value === null) return false;
	return typeof (value as XML.Element).name === "string";
}

/**
 * Reads the document out of everything `stringify` accepts, wrapping a bare root
 * element in the document that holds it. An input carrying no root element is the
 * failure the Result promises, rather than a throw from deeper in serialization.
 */
function toDocument(input: XML | XML.Input): Result<XML.Document, XMLStringifyError> {
	if (input instanceof XML) return success(input.toJSON());
	if (isElement(input)) return success({ root: input });
	if (isElement(input.root)) return success(input);

	return failure(
		new XMLStringifyError("Expected a document carrying a root element, or the element itself."),
	);
}
