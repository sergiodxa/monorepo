/**
 * Provides the XML class and error types for parsing, traversing, and
 * serializing XML documents.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, success } from "@pkg/result";

import { cloneDeclaration } from "./lib/clone-declaration";
import { cloneElement } from "./lib/clone-element";
import { parseDocument } from "./lib/parse-document";
import { stringifyDocument } from "./lib/stringify-document";
import {
	collectInElement,
	findInElement,
	normalizePath,
	queryFromElements,
	startsWithRoot,
} from "./lib/traversal";

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
	 * Serializes an XML instance or root element into XML text.
	 *
	 * @param input - The XML instance or root element to serialize
	 * @returns A Result containing the XML string or a serialization error
	 */
	static stringify(input: XML | XML.Element): Result<string, XMLStringifyError> {
		if (input instanceof XML) return success(input.toString());

		let result = stringifyDocument({ root: input });
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
