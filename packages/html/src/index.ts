/**
 * Reads a served page without a browser: parse the markup once, then address the
 * document by role and accessible name, by field name, by table position or by
 * definition term. Read-only, so there is nothing to click and no layout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import { definitionFor } from "./lib/definitions.js";
import { snapshot, valueOf } from "./lib/element.js";
import { accessibleName } from "./lib/name.js";
import { parseDocument } from "./lib/parse-document.js";
import { roleOf } from "./lib/roles.js";
import { pick, resolve, unique } from "./lib/select.js";
import { rowCells, tableRows } from "./lib/tables.js";
import { normalize, visibleText } from "./lib/text.js";
import { isHidden, isNonRendered } from "./lib/visibility.js";

/** Signals that a source carried no markup to query. */
export class HTMLParseError extends Error {
	override name = "HTMLParseError";
}

/**
 * Signals that a lookup produced no single answer, carrying the identities the
 * document did hold under the same lookup so a report can name them.
 */
export class HTMLQueryError extends Error {
	override name = "HTMLQueryError";

	readonly available: string[];

	/**
	 * @param message - What was looked up and what stood in the way
	 * @param available - The identities the document holds under the same lookup
	 */
	constructor(message: string, available: string[]) {
		super(message);
		this.available = available;
	}
}

/** Signals that nothing in the document answered the lookup. */
export class HTMLNotFoundError extends HTMLQueryError {
	override name = "HTMLNotFoundError";
}

/**
 * Signals that several elements answered the lookup, carrying each of them with its
 * 1-based position so a caller reports the choice rather than guessing at one.
 */
export class HTMLAmbiguousMatchError extends HTMLQueryError {
	override name = "HTMLAmbiguousMatchError";

	readonly candidates: HTML.Element[];

	/**
	 * @param message - The lookup and the candidates it left open
	 * @param available - The identities the document holds under the same lookup
	 * @param candidates - Every match, in document order, carrying its position
	 */
	constructor(message: string, available: string[], candidates: HTML.Element[]) {
		super(message, available);
		this.candidates = candidates;
	}
}

/** Groups the public types under a single import surface. */
export namespace HTML {
	/**
	 * One element as a lookup answered it. `attributes` and `value` are the markup's
	 * own spelling, and `name` and `text` are whitespace-normalized.
	 */
	export interface Element {
		tag: string;
		role?: string;
		name: string;
		text: string;
		value?: string;
		attributes: Record<string, string>;
		disabled: boolean;
		position: number;
	}

	/** Which of several matches to take; an ordinal counts from 1. */
	export type Position = "first" | "last" | number;

	/** What every lookup accepts: the choice among matches, and what markup hides. */
	export interface Options {
		at?: Position | undefined;
		includeHidden?: boolean | undefined;
	}

	/**
	 * How to address an element. `name` matches the whole accessible name and
	 * `nameContaining` a part of it, both case-sensitively; a selector carrying
	 * neither addresses every element the role matched.
	 */
	export interface Selector extends Options {
		role?: string | undefined;
		name?: string | undefined;
		nameContaining?: string | undefined;
		value?: string | undefined;
	}

	/** How to address a control: its `name` attribute, and a value to narrow a group. */
	export interface FieldOptions extends Options {
		value?: string | undefined;
	}

	/**
	 * Where a cell sits: rows and columns count from 1 over body rows, and `at`
	 * chooses among several tables.
	 */
	export interface CellSelector extends Options {
		row: number;
		column: number;
		includeHeader?: boolean | undefined;
	}
}

/**
 * A parsed page, queried as many times as a caller needs — every lookup re-reads
 * the document, so parse once and hold the instance.
 */
export class HTML {
	#document: Document;

	/** Holds a parsed document; `HTML.parse` is how a caller obtains one. */
	private constructor(document: Document) {
		this.#document = document;
	}

	/**
	 * Parses markup into a queryable document.
	 *
	 * @param source - A full page or a fragment of one
	 * @returns The document, or the failure a source carrying no markup produces
	 */
	static parse(source: string): Result<HTML, HTMLParseError> {
		let document = parseDocument(source);
		if (isFailure(document)) return document;
		return success(new HTML(document.data));
	}

	/** The `<title>` text, normalized, absent when the page carries no title. */
	get title(): string | undefined {
		let title = this.#document.querySelector("title");
		if (!title) return undefined;
		return normalize(title.textContent ?? "");
	}

	/** Everything a reader would see, with what markup hides left out. */
	get text(): string {
		return visibleText(this.#document.body ?? this.#document.documentElement);
	}

	/**
	 * Reads a meta tag's content, matching `name` or `property` so a page's
	 * description and its `og:` tags are one lookup.
	 *
	 * @param name - The `name` or `property` the tag carries
	 */
	meta(name: string): Result<string, HTMLNotFoundError> {
		let entries = Array.from(this.#document.querySelectorAll("meta")).map((tag) => ({
			key: tag.getAttribute("name") ?? tag.getAttribute("property") ?? "",
			content: tag.getAttribute("content") ?? "",
		}));

		let match = entries.find((entry) => entry.key === name);
		if (match) return success(match.content);

		let available = unique(entries.map((entry) => entry.key));
		let message = `No meta tag "${name}" in the document. Present: ${available.join(", ")}.`;
		return failure(new HTMLNotFoundError(message, available));
	}

	/**
	 * Reads a link's `href`, matching when the requested value is one token of `rel`,
	 * since `rel` is a token list.
	 *
	 * @param rel - The relationship token to look for
	 */
	link(rel: string): Result<string, HTMLNotFoundError> {
		let entries = Array.from(this.#document.querySelectorAll("link")).map((tag) => ({
			tokens: normalize(tag.getAttribute("rel") ?? "").split(" "),
			href: tag.getAttribute("href") ?? "",
		}));

		let match = entries.find((entry) => entry.tokens.includes(rel));
		if (match) return success(match.href);

		let available = unique(entries.flatMap((entry) => entry.tokens));
		let message = `No link with rel "${rel}" in the document. Present: ${available.join(", ")}.`;
		return failure(new HTMLNotFoundError(message, available));
	}

	/**
	 * Addresses one element by role and accessible name.
	 *
	 * @param selector - The role, the name, and the choice among several matches
	 * @returns The element, or why one could not be chosen
	 */
	query(selector: HTML.Selector = {}): Result<HTML.Element, HTMLQueryError> {
		let { family, matched } = this.#candidates(selector);

		return resolve({
			matched,
			available: unique(family.map(accessibleName)),
			subject: describeSelector(selector),
			at: selector.at,
		});
	}

	/**
	 * Lists every element the selector matches, in document order, which is how a
	 * caller counts matches or reads a repeated element.
	 *
	 * @param selector - The role, the name, and what markup hides
	 */
	queryAll(selector: HTML.Selector = {}): HTML.Element[] {
		return this.#candidates(selector).matched.map((element, index) => snapshot(element, index + 1));
	}

	/**
	 * Addresses a control by its `name` attribute — input, textarea, select or
	 * button — where a value narrows a group sharing one name, which is how a radio
	 * group and a submit-intent button are addressed.
	 *
	 * @param name - The `name` attribute the control carries
	 * @param options - The value to narrow by, and the choice among several matches
	 */
	field(name: string, options: HTML.FieldOptions = {}): Result<HTML.Element, HTMLQueryError> {
		let fields = this.#elements(options).filter((element) => element.hasAttribute("name"));
		let named = fields.filter((element) => element.getAttribute("name") === name);

		let matched =
			options.value === undefined
				? named
				: named.filter((element) => valueOf(element) === options.value);

		let available =
			options.value !== undefined && named.length > 0
				? unique(named.map((element) => valueOf(element) ?? ""))
				: unique(fields.map((element) => element.getAttribute("name") ?? ""));

		return resolve({
			matched,
			available,
			subject: describeField(name, options.value),
			at: options.at,
		});
	}

	/**
	 * Reads a table cell by row and column, both counted from 1 over body rows.
	 * Columns count the cells the row carries.
	 *
	 * @param selector - The row, the column, and whether header rows count
	 */
	cell(selector: HTML.CellSelector): Result<HTML.Element, HTMLQueryError> {
		let tables = this.#elements(selector).filter((element) => roleOf(element) === "table");
		let table = pick({
			matched: tables,
			available: unique(tables.map(accessibleName)),
			subject: "a table",
			at: selector.at,
		});
		if (isFailure(table)) return table;

		let rows = tableRows(table.data.element, selector.includeHeader === true);
		let row = selector.row >= 1 ? rows.at(selector.row - 1) : undefined;
		let texts = rows.map(visibleText);
		if (!row) {
			let message = `No row ${String(selector.row)} in the table; it carries ${String(rows.length)}.`;
			return failure(new HTMLNotFoundError(message, unique(texts)));
		}

		let cells = rowCells(row);
		let cell = selector.column >= 1 ? cells.at(selector.column - 1) : undefined;
		if (!cell) {
			let message = `No column ${String(selector.column)} in row ${String(selector.row)}; it carries ${String(cells.length)} cells.`;
			return failure(new HTMLNotFoundError(message, cells.map(visibleText)));
		}

		return success(snapshot(cell, selector.column));
	}

	/**
	 * Reads the definition paired with a term, matching the term's text exactly.
	 *
	 * @param term - The term's text, whitespace-normalized
	 * @param options - The choice among several terms of the same text
	 */
	definition(term: string, options: HTML.Options = {}): Result<HTML.Element, HTMLQueryError> {
		let terms = this.#elements(options).filter((element) => roleOf(element) === "term");
		let available = unique(terms.map(visibleText));

		let match = pick({
			matched: terms.filter((element) => visibleText(element) === term),
			available,
			subject: `a term "${term}"`,
			at: options.at,
		});
		if (isFailure(match)) return match;

		let definition = definitionFor(match.data.element);
		if (!definition) {
			return failure(new HTMLNotFoundError(`The term "${term}" carries no definition.`, available));
		}

		return success(snapshot(definition, match.data.position));
	}

	/**
	 * Splits the document into the elements the role matched and the ones that also
	 * matched the name, since the wider set is what a miss reports as present.
	 */
	#candidates(selector: HTML.Selector): { family: Element[]; matched: Element[] } {
		let elements = this.#elements(selector);

		let family =
			selector.role === undefined
				? elements
				: elements.filter((element) => roleOf(element) === selector.role);

		let matched = family.filter((element) => {
			if (selector.value !== undefined && valueOf(element) !== selector.value) return false;
			if (selector.name === undefined && selector.nameContaining === undefined) return true;

			let name = accessibleName(element);
			if (selector.name !== undefined && name !== selector.name) return false;
			if (selector.nameContaining !== undefined && !name.includes(selector.nameContaining)) {
				return false;
			}

			return true;
		});

		return { family, matched };
	}

	/**
	 * Lists the elements a lookup may reach: everything a browser renders, and what
	 * markup hides only when the caller asks for it.
	 */
	#elements(options: HTML.Options): Element[] {
		let includeHidden = options.includeHidden === true;

		return Array.from(this.#document.querySelectorAll("*")).filter((element) => {
			if (isNonRendered(element.localName.toLowerCase())) return false;
			return includeHidden || !isHidden(element);
		});
	}
}

/** Names what a selector asked for, which is what a failure message opens with. */
function describeSelector(selector: HTML.Selector): string {
	let subject = selector.role === undefined ? "an element" : `a ${selector.role}`;
	if (selector.name !== undefined) subject += ` named "${selector.name}"`;
	if (selector.nameContaining !== undefined) {
		subject += ` whose name contains "${selector.nameContaining}"`;
	}
	if (selector.value !== undefined) subject += ` with value "${selector.value}"`;
	return subject;
}

/** Names what a field lookup asked for, value included when it narrowed a group. */
function describeField(name: string, value: string | undefined): string {
	let subject = `a field named "${name}"`;
	if (value !== undefined) subject += ` with value "${value}"`;
	return subject;
}
