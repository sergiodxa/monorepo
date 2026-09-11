/**
 * The addressing vocabulary `html` and `browser` share: how a tool call's
 * arguments become a backend-independent element query and a predicate, and how
 * a lookup that answered with nothing, or with too much, is put into words.
 *
 * Nothing here reads a document or drives a browser. The rules live in one
 * place so a document is addressed the same way whether the answer comes from
 * parsed markup or from a live page, and the namespace choice stays a question
 * of whether a browser is needed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { SpecError } from "../errors.js";
import type { ToolParam } from "../plugin.js";
import type { ToolArg, Value } from "../values.js";

import { ExpectationError, ToolError } from "../errors.js";

/** The word that heads a lookup by `name` attribute, where a role word sits. */
const FIELD_WORD = "field";

/** The words that choose one match when several answer. */
const ORDINAL_WORDS = ["first", "nth", "last"];

/** The words that assert on what a query found. */
const PREDICATE_WORDS = [
	"exists",
	"count",
	"value",
	"attribute",
	"enabled",
	"disabled",
	"in_viewport",
];

/**
 * Tag names a spec is likely to write where a role belongs, mapped to the role
 * that tag exposes — absent where the tag exposes none. Addressing a tag name
 * is addressing markup rather than what a person perceives, so it is refused.
 */
const TAG_ROLES = new Map<string, string | undefined>([
	["a", "link"],
	["dd", "definition"],
	["div", undefined],
	["dt", "term"],
	["footer", "contentinfo"],
	["h1", "heading"],
	["h2", "heading"],
	["h3", "heading"],
	["h4", "heading"],
	["h5", "heading"],
	["h6", "heading"],
	["header", "banner"],
	["iframe", undefined],
	["img", "image"],
	["input", "textbox"],
	["label", undefined],
	["li", "listitem"],
	["nav", "navigation"],
	["ol", "list"],
	["p", "paragraph"],
	["section", "region"],
	["select", "combobox"],
	["span", undefined],
	["td", "cell"],
	["textarea", "textbox"],
	["th", "columnheader"],
	["tr", "row"],
	["ul", "list"],
]);

/**
 * The words a tool addressing an element must declare, since the runtime reads
 * a bare identifier as a symbol only where the descriptor named it. A tool
 * spreads these after the parameters its own name fixes.
 */
export const QUERY_PARAMS: ToolParam[] = [
	word("field", 'Heads a lookup by `name` attribute: `field "tip"`.'),
	word("containing", "Opts a role lookup into matching a part of the accessible name."),
	word("first", "Takes the first of several matches."),
	word("nth", "Takes the match at the 1-based position that follows it."),
	word("last", "Takes the last of several matches."),
	word("row", "Introduces a cell's 1-based row, counted over body rows."),
	word("column", "Introduces a cell's 1-based column."),
	word("including", "Followed by `header`, counts header rows among a table's rows."),
	word("header", "The second word of `including header`."),
	word("exists", "Reports presence as true or false rather than failing on absence."),
	word("count", "Asserts the number of matches that follows it; the one set predicate."),
	word("value", "Asserts the control's value, and narrows a field group sharing one name."),
	word("attribute", "Asserts the raw markup attribute that follows it, by name and value."),
	word("enabled", "Asserts the element is not disabled."),
	word("disabled", "Asserts the element is disabled."),
	word("in_viewport", "Asserts the element is scrolled into view; only a browser can answer it."),
];

/** The words a tool reading one value — a title, a meta tag, text — declares. */
export const ASSERTION_PARAMS: ToolParam[] = [
	word("containing", "Asserts the value contains the string that follows it."),
	word("exactly", "Asserts the value equals the string that follows it."),
	word("exists", "Reports presence as true or false rather than failing on absence."),
];

/** The word `fill … with` and `type … with` put between element and text. */
export const FILL_PARAMS: ToolParam[] = [
	word("with", "Separates the addressed element from the text to put into it."),
];

/** Which of several matches a query takes; an ordinal counts from 1. */
export type Ordinal = "first" | "last" | number;

/** Where a cell sits: 1-based over body rows, header rows joining on request. */
export interface CellAddress {
	row: number;
	column: number;
	includeHeader: boolean;
}

/**
 * One element addressed the way a person perceives it. `kind` says which of the
 * four lookups the head selected, and the fields a lookup does not use stay
 * absent, so a backend maps this onto its own selector without re-parsing.
 */
export interface ElementQuery {
	kind: "role" | "field" | "cell" | "definition";
	/** The ARIA role, for a role lookup. */
	role?: string;
	/** The `name` attribute, for a field lookup. */
	field?: string;
	/** The term whose definition is read, for a definition lookup. */
	term?: string;
	/** The row and column, for a cell lookup. */
	cell?: CellAddress;
	/** The whole accessible name, matched exactly. */
	name?: string;
	/** A part of the accessible name, matched as a substring. */
	nameContaining?: string;
	/** The value that narrows a group of fields sharing one name. */
	value?: string;
	/** Which match to take, where the query admits several. */
	at?: Ordinal;
}

/**
 * What a query asserts about what it found. `present` is the absent predicate:
 * the element must be there. `count` accepts any number of matches; every other
 * predicate requires exactly one.
 */
export type Predicate =
	| { kind: "present" }
	| { kind: "exists" }
	| { kind: "count"; count: number }
	| { kind: "value"; value: string }
	| { kind: "attribute"; name: string; value: string }
	| { kind: "state"; enabled: boolean }
	| { kind: "in_viewport" };

/** The head a tool's own name already fixed, where the arguments do not carry it. */
export type QueryHead =
	| { kind: "role"; role: string }
	| { kind: "field" }
	| { kind: "cell" }
	| { kind: "definition" };

/**
 * How much of the predicate clause a tool admits. An observable asserts, so it
 * takes every predicate; an action only addresses, so it takes `value` alone —
 * the clause that names one member of a group sharing a `name` attribute.
 */
export type PredicateMode = "assert" | "narrow";

/** How a tool's arguments are read. */
export interface QueryOptions {
	/** Where the query starts; an `html` tool passes 1, its source being first. */
	from?: number;
	/** The head to use, where the tool's name already named it. */
	head?: QueryHead;
	/** Words that end the query, e.g. the `with` of `fill … with`. */
	stopAt?: readonly string[];
	/** How much the predicate clause may do; `assert` where it is left out. */
	predicates?: PredicateMode;
}

/** A parsed query: what to look for, what to assert, and where parsing stopped. */
export interface ParsedQuery {
	query: ElementQuery;
	predicate: Predicate;
	/** Index of the first argument the query did not consume. */
	next: number;
}

/** Whether a string is compared whole or as a part. */
export type MatchMode = "exact" | "substring";

/**
 * What a value-reading observable — a title, a meta tag, the visible text — was
 * asked to do: hand the value back, report presence, or assert on it.
 */
export type Assertion =
	| { kind: "read" }
	| { kind: "exists" }
	| { kind: "match"; text: string; mode: MatchMode };

/**
 * One match a failure reports, as much of it as a person needs to tell it
 * apart. Parsed markup knows the tag and a live page knows the role, so a
 * candidate carries whichever its backend saw.
 */
export interface Candidate {
	position: number;
	name: string;
	tag?: string;
	role?: string;
}

/**
 * What the document held instead: the accessible names under the role asked
 * for, and the roles carrying the name asked for. Between them they are usually
 * the whole diagnosis.
 */
export interface NearMatches {
	names?: readonly string[];
	roles?: readonly string[];
}

/**
 * Read an element query out of a tool call's arguments.
 *
 * @param tool - Qualified tool name for diagnostics, e.g. `"html.element"`.
 * @param args - The call's evaluated arguments.
 * @param options - Where the query starts, and what the tool's name already fixed.
 * @returns The query, its predicate, and where parsing stopped.
 */
export function parseQuery(
	tool: string,
	args: ToolArg[],
	options: QueryOptions = {},
): Result<ParsedQuery, SpecError> {
	let reader = new Reader(tool, args, options.from ?? 0, options.stopAt ?? []);
	let head = options.head === undefined ? readHead(reader) : success(options.head);
	if (isFailure(head)) return head;

	let query = readSubject(reader, head.data);
	if (isFailure(query)) return query;

	let at = readOrdinal(reader);
	if (isFailure(at)) return at;
	if (at.data !== undefined) query.data.at = at.data;

	let mode = options.predicates ?? "assert";
	let predicate = readPredicate(reader, query.data, mode);
	if (isFailure(predicate)) return predicate;

	if (predicate.data.kind === "count" && at.data !== undefined) {
		return reader.fail(
			"counts every match, so `count` cannot follow `first`, `nth` or `last`; drop the ordinal",
		);
	}
	if (query.data.kind === "field" && predicate.data.kind === "value") {
		/**
		 * A group sharing one `name` — a radio group, a set of submit buttons —
		 * is addressed by its value, so the same clause narrows the lookup and
		 * asserts. Anywhere else `value` reads the one element the query found.
		 */
		query.data.value = predicate.data.value;
	}

	let end = reader.expectEnd();
	if (isFailure(end)) return end;

	/** Narrowing said which element to act on, which asserts nothing about it. */
	let asserted = mode === "narrow" ? PRESENT : predicate.data;
	return success({ query: query.data, predicate: asserted, next: reader.index });
}

/**
 * Read `fill … with "text"`, `type … with "text"` or `select … with "option"`:
 * the same addressing, narrowing included, then the text. What the text does to
 * the control is the backend's business, not the grammar's.
 *
 * @param tool - Qualified tool name for diagnostics, e.g. `"browser.fill"`.
 * @param args - The call's evaluated arguments.
 * @param options - Where the query starts, and what the tool's name already fixed.
 * @returns The addressed element and the text to put into it.
 */
export function parseFill(
	tool: string,
	args: ToolArg[],
	options: QueryOptions = {},
): Result<{ query: ElementQuery; text: string }, SpecError> {
	let parsed = parseQuery(tool, args, { ...options, predicates: "narrow", stopAt: ["with"] });
	if (isFailure(parsed)) return parsed;

	let reader = new Reader(tool, args, parsed.data.next, []);
	let separator = reader.takeWord(["with"]);
	if (isFailure(separator)) return separator;
	let text = reader.takeText("text");
	if (isFailure(text)) return text;
	let end = reader.expectEnd();
	if (isFailure(end)) return end;

	return success({ query: parsed.data.query, text: text.data });
}

/**
 * Read what a value-reading observable was asked to do. A bare string compares
 * in `fallback` mode, `containing` opts into a substring and `exactly` into
 * equality, and `exists` turns a missing value from a failure into `false`.
 *
 * @param tool - Qualified tool name for diagnostics, e.g. `"html.meta"`.
 * @param args - The call's evaluated arguments.
 * @param index - Where the assertion starts.
 * @param fallback - How a bare string compares.
 * @returns The assertion the call carried.
 */
export function parseAssertion(
	tool: string,
	args: ToolArg[],
	index: number,
	fallback: MatchMode,
): Result<Assertion, SpecError> {
	let reader = new Reader(tool, args, index, []);
	let assertion = readAssertion(reader, fallback);
	if (isFailure(assertion)) return assertion;
	let end = reader.expectEnd();
	if (isFailure(end)) return end;
	return assertion;
}

/**
 * Name what a query asked for, in the words a person would use for it.
 *
 * @param query - The query to describe.
 * @returns One noun phrase, e.g. `a button named "Sign in"`.
 */
export function describeQuery(query: ElementQuery): string {
	if (query.kind === "cell") {
		let cell = query.cell ?? { row: 1, column: 1, includeHeader: false };
		let subject = `the cell at row ${cell.row}, column ${cell.column}`;
		if (cell.includeHeader) subject += " counting header rows";
		if (query.at !== undefined) subject += ` of ${ordinalPhrase(query.at)} table`;
		return subject;
	}
	if (query.kind === "definition") {
		let subject = `the definition of ${quote(query.term ?? "")}`;
		if (query.at !== undefined) subject += ` under ${ordinalPhrase(query.at)} term of that text`;
		return subject;
	}

	let article = query.at === undefined ? "a" : ordinalPhrase(query.at);
	let subject =
		query.kind === "field" ? `field named ${quote(query.field ?? "")}` : (query.role ?? "element");
	let described = `${article} ${subject}`;
	if (query.name !== undefined) described += ` named ${quote(query.name)}`;
	if (query.nameContaining !== undefined) {
		described += ` whose name contains ${quote(query.nameContaining)}`;
	}
	if (query.value !== undefined && query.kind === "field") {
		described += ` with the value ${quote(query.value)}`;
	}
	return described;
}

/**
 * Render every match with its position, which is what an ambiguity asks a
 * person to choose between.
 *
 * @param candidates - The matches, in document order.
 * @returns One line, e.g. `#1 <a> "Profile", #2 <button> "Profile"`.
 */
export function formatCandidates(candidates: readonly Candidate[]): string {
	return candidates
		.map((candidate) => {
			let name = candidate.name === "" ? "(no accessible name)" : quote(candidate.name);
			let identity =
				candidate.tag === undefined ? (candidate.role ?? "element") : `<${candidate.tag}>`;
			return `#${candidate.position} ${identity} ${name}`;
		})
		.join(", ");
}

/**
 * The failure a query with several answers reports: every candidate with its
 * position, and the words that take one of them.
 *
 * @param tool - Qualified tool name, e.g. `"html.element"`.
 * @param query - The query that matched too much.
 * @param candidates - Every match, in document order.
 * @returns The error to hand back.
 */
export function ambiguousMatch(
	tool: string,
	query: ElementQuery,
	candidates: readonly Candidate[],
): ToolError {
	let error = new ToolError(
		`${tool} matched ${candidates.length} elements for ${describeQuery(query)}: ${formatCandidates(candidates)}`,
	);
	error.remedy = "Choose one with `first`, `nth <n>` or `last`, or address a narrower scope.";
	return error;
}

/**
 * The failure a query with no answer reports: what was looked for, and what the
 * document held instead — the same role under another name, the same name under
 * another role.
 *
 * @param tool - Qualified tool name, e.g. `"html.element"`.
 * @param query - The query that matched nothing.
 * @param near - What the document held under the same lookup.
 * @returns The error to hand back.
 */
export function noMatch(
	tool: string,
	query: ElementQuery,
	near: NearMatches = {},
): ExpectationError {
	let message = `${tool} found ${describeQuery(query)} nowhere in the document`;
	if (near.names !== undefined && near.names.length > 0) {
		message += `. Present under the same lookup: ${near.names.map(quote).join(", ")}`;
	}
	if (near.roles !== undefined && near.roles.length > 0) {
		message += `. That name is carried by: ${near.roles.join(", ")}`;
	}
	let error = new ExpectationError(message, describeQuery(query), null);
	error.remedy = "Add `exists` where the absence is what the test is about.";
	return error;
}

/** The predicate an unqualified query carries: the element must be there. */
const PRESENT: Predicate = { kind: "present" };

/** Read the head: a role word, or the `field` word that stands where one sits. */
function readHead(reader: Reader): Result<QueryHead, SpecError> {
	let word = reader.peekWord();
	if (word === undefined) {
		return reader.fail(
			`expects an accessibility role as a bare word (e.g. button, link, textbox) or \`${FIELD_WORD} "name"\``,
		);
	}
	reader.skip();
	if (word === FIELD_WORD) return success({ kind: "field" });

	let tag = TAG_ROLES.get(word);
	if (TAG_ROLES.has(word)) {
		let advice =
			tag === undefined
				? `a <${word}> carries no role of its own — address it by the role of what it holds`
				: `a <${word}> is a ${tag} — address it as \`${tag}\``;
		return reader.fail(`addresses roles, not tag names: ${advice}`);
	}
	return success({ kind: "role", role: word });
}

/** Read the operands the head takes, which is what makes it a query. */
function readSubject(reader: Reader, head: QueryHead): Result<ElementQuery, SpecError> {
	if (head.kind === "field") {
		let name = reader.takeString("field name");
		if (isFailure(name)) return name;
		return success({ kind: "field", field: name.data });
	}
	if (head.kind === "definition") {
		let term = reader.takeString("term");
		if (isFailure(term)) return term;
		return success({ kind: "definition", term: term.data });
	}
	if (head.kind === "cell") {
		let cell = readCell(reader);
		if (isFailure(cell)) return cell;
		return success({ kind: "cell", cell: cell.data });
	}

	let query: ElementQuery = { kind: "role", role: head.role };
	let name = readName(reader);
	if (isFailure(name)) return name;
	if (name.data?.mode === "exact") query.name = name.data.text;
	if (name.data?.mode === "substring") query.nameContaining = name.data.text;
	return success(query);
}

/**
 * Read `row <n> column <n> [including header]`. Rows and columns count from 1
 * over body rows, which is the counting a person does reading the table.
 */
function readCell(reader: Reader): Result<CellAddress, SpecError> {
	let rowWord = reader.takeWord(["row"]);
	if (isFailure(rowWord)) return rowWord;
	let row = reader.takeOrdinalNumber("row");
	if (isFailure(row)) return row;
	let columnWord = reader.takeWord(["column"]);
	if (isFailure(columnWord)) return columnWord;
	let column = reader.takeOrdinalNumber("column");
	if (isFailure(column)) return column;

	let includeHeader = false;
	if (reader.peekWord() === "including") {
		reader.skip();
		let header = reader.takeWord(["header"]);
		if (isFailure(header)) return header;
		includeHeader = true;
	}
	return success({ row: row.data, column: column.data, includeHeader });
}

/**
 * Read the accessible name a role lookup matches. A bare string matches the
 * whole name, `containing` opts into a substring, and a role lookup with no
 * name at all addresses every element of that role.
 */
function readName(
	reader: Reader,
): Result<{ text: string; mode: MatchMode } | undefined, SpecError> {
	let word = reader.peekWord();
	if (word === "exactly") {
		return reader.fail(
			"matches an accessible name exactly already; `containing` is the substring opt-in",
		);
	}
	if (word === "containing") {
		reader.skip();
		let part = reader.takeString("name");
		if (isFailure(part)) return part;
		return success({ text: part.data, mode: "substring" });
	}
	if (word !== undefined) return success(undefined);
	if (reader.atEnd()) return success(undefined);

	let name = reader.takeString("name");
	if (isFailure(name)) return name;
	return success({ text: name.data, mode: "exact" });
}

/** Read `first`, `last` or `nth <n>`, the opt-ins into one of several matches. */
function readOrdinal(reader: Reader): Result<Ordinal | undefined, SpecError> {
	let word = reader.peekWord();
	if (word === undefined || !ORDINAL_WORDS.includes(word)) return success(undefined);
	reader.skip();
	if (word === "first") return success("first");
	if (word === "last") return success("last");
	let position = reader.takeOrdinalNumber("nth");
	if (isFailure(position)) return position;
	return success(position.data);
}

/** Read the predicate the query asserts with, `present` where none was written. */
function readPredicate(
	reader: Reader,
	query: ElementQuery,
	mode: PredicateMode,
): Result<Predicate, SpecError> {
	let word = reader.peekWord();
	/**
	 * A narrowing query asserts nothing, so everything but the clause that
	 * narrows is left where it lies: the form the call belongs to names it,
	 * with the word it was still waiting for.
	 */
	if (mode === "narrow" && (word === undefined || !PREDICATE_WORDS.includes(word))) {
		return success(PRESENT);
	}
	if (word === undefined) {
		if (reader.atEnd()) return success(PRESENT);
		return reader.fail(
			`expects one of the predicates ${PREDICATE_WORDS.join(", ")} after the element it addresses`,
		);
	}
	if (!PREDICATE_WORDS.includes(word)) {
		return reader.fail(
			`does not understand the word "${word}"; predicates: ${PREDICATE_WORDS.join(", ")}`,
		);
	}
	if (mode === "narrow") {
		let refused = narrowed(reader, query, word);
		if (refused !== undefined) return refused;
	}
	reader.skip();

	if (word === "exists") return success({ kind: "exists" });
	if (word === "enabled") return success({ kind: "state", enabled: true });
	if (word === "disabled") return success({ kind: "state", enabled: false });
	if (word === "in_viewport") return success({ kind: "in_viewport" });
	if (word === "count") {
		if (query.kind === "cell" || query.kind === "definition") {
			return reader.fail(
				"counts a role or field lookup; a cell and a definition each address one element",
			);
		}
		let count = reader.takeCount();
		if (isFailure(count)) return count;
		return success({ kind: "count", count: count.data });
	}
	if (word === "value") {
		let value = reader.takeText("value");
		if (isFailure(value)) return value;
		return success({ kind: "value", value: value.data });
	}
	let name = reader.takeString("attribute name");
	if (isFailure(name)) return name;
	let value = reader.takeText("attribute value");
	if (isFailure(value)) return value;
	return success({ kind: "attribute", name: name.data, value: value.data });
}

/**
 * Refuse every predicate an action cannot act on. `value` is the exception the
 * mode exists for: on a field lookup it names which member of a group sharing
 * one `name` attribute to act on, which is addressing rather than asserting.
 */
function narrowed(
	reader: Reader,
	query: ElementQuery,
	word: string,
): Result<Predicate, SpecError> | undefined {
	if (word === "value") {
		if (query.kind === "field") return undefined;
		return reader.fail(
			`narrows a group of fields sharing one name with \`value\`; on a ${query.kind} lookup \`value\` asserts, which ${reader.namespace}.element does`,
		);
	}
	return reader.fail(
		`acts on an element, so it takes no \`${word}\` predicate; assert with ${reader.namespace}.element instead`,
	);
}

/** Read the assertion form a value-reading observable takes. */
function readAssertion(reader: Reader, fallback: MatchMode): Result<Assertion, SpecError> {
	if (reader.atEnd()) return success({ kind: "read" });
	let word = reader.peekWord();
	if (word === "exists") {
		reader.skip();
		return success({ kind: "exists" });
	}
	if (word === "containing" || word === "exactly") {
		reader.skip();
		let text = reader.takeString("expected value");
		if (isFailure(text)) return text;
		return success({
			kind: "match",
			text: text.data,
			mode: word === "containing" ? "substring" : "exact",
		});
	}
	if (word !== undefined) {
		return reader.fail(
			`does not understand the word "${word}"; it takes an expected value, \`containing\`, \`exactly\` or \`exists\``,
		);
	}
	let text = reader.takeString("expected value");
	if (isFailure(text)) return text;
	return success({ kind: "match", text: text.data, mode: fallback });
}

/**
 * Walks one tool call's arguments. It carries the tool's name so every failure
 * opens with it, and the words that end the query, so a `fill … with` stops
 * where its value begins.
 */
class Reader {
	/** Index of the argument the next read consumes. */
	index: number;

	#tool: string;
	#args: ToolArg[];
	#stopAt: readonly string[];

	constructor(tool: string, args: ToolArg[], from: number, stopAt: readonly string[]) {
		this.#tool = tool;
		this.#args = args;
		this.#stopAt = stopAt;
		this.index = from;
	}

	/** The namespace the call was written under, which names its sibling tools. */
	get namespace(): string {
		return this.#tool.split(".")[0] ?? this.#tool;
	}

	/** The bare word at the cursor, absent where the next argument is a value. */
	peekWord(): string | undefined {
		let arg = this.#args[this.index];
		if (arg === undefined || arg.kind !== "word") return undefined;
		if (this.#stopAt.includes(arg.word)) return undefined;
		return arg.word;
	}

	/** Whether the arguments, or the part this query owns, are used up. */
	atEnd(): boolean {
		let arg = this.#args[this.index];
		if (arg === undefined) return true;
		return arg.kind === "word" && this.#stopAt.includes(arg.word);
	}

	/** Accept the argument at the cursor, having read it with `peekWord`. */
	skip(): void {
		this.index += 1;
	}

	/** Take a string argument, e.g. an accessible name or a field name. */
	takeString(what: string): Result<string, SpecError> {
		let arg = this.#args[this.index];
		if (arg === undefined || arg.kind !== "value" || typeof arg.value !== "string") {
			return this.fail(`expects a string for its ${what} (argument ${this.index + 1})`);
		}
		this.index += 1;
		return success(arg.value);
	}

	/** Take a value compared as a string, which is how markup spells every one. */
	takeText(what: string): Result<string, SpecError> {
		let arg = this.#args[this.index];
		if (arg === undefined || arg.kind !== "value" || !isText(arg.value)) {
			return this.fail(
				`expects a string, number or boolean for its ${what} (argument ${this.index + 1})`,
			);
		}
		this.index += 1;
		return success(String(arg.value));
	}

	/** Take a 1-based position: a row, a column, an `nth`. */
	takeOrdinalNumber(what: string): Result<number, SpecError> {
		let arg = this.#args[this.index];
		if (
			arg === undefined ||
			arg.kind !== "value" ||
			typeof arg.value !== "number" ||
			!Number.isInteger(arg.value) ||
			arg.value < 1
		) {
			return this.fail(
				`expects a whole number of 1 or more for its ${what} (argument ${this.index + 1}); ordinals count from 1`,
			);
		}
		this.index += 1;
		return success(arg.value);
	}

	/** Take a count, where zero is the number a deliberate absence asserts. */
	takeCount(): Result<number, SpecError> {
		let arg = this.#args[this.index];
		if (
			arg === undefined ||
			arg.kind !== "value" ||
			typeof arg.value !== "number" ||
			!Number.isInteger(arg.value) ||
			arg.value < 0
		) {
			return this.fail(
				`expects a whole number of matches after \`count\` (argument ${this.index + 1})`,
			);
		}
		this.index += 1;
		return success(arg.value);
	}

	/** Take one of the words a clause is spelled with, e.g. the `row` of a cell. */
	takeWord(accepted: readonly string[]): Result<string, SpecError> {
		let arg = this.#args[this.index];
		if (arg === undefined || arg.kind !== "word") {
			return this.fail(
				`expects the word ${accepted.map((word) => `\`${word}\``).join(" or ")} as argument ${this.index + 1}`,
			);
		}
		if (!accepted.includes(arg.word)) {
			return this.fail(
				`does not understand the word "${arg.word}" here; expected ${accepted.map((word) => `\`${word}\``).join(" or ")}`,
			);
		}
		this.index += 1;
		return success(arg.word);
	}

	/** Refuse anything the grammar left over, naming what was not understood. */
	expectEnd(): Result<undefined, SpecError> {
		if (this.atEnd()) return success(undefined);
		let arg = this.#args[this.index];
		let extra = arg?.kind === "word" ? `the word "${arg.word}"` : "an extra argument";
		let wanted =
			this.#stopAt.length === 0
				? ""
				: `; the form continues with ${this.#stopAt.map((stop) => `\`${stop}\``).join(" or ")}`;
		return this.fail(`does not take ${extra} at argument ${this.index + 1}${wanted}`);
	}

	/** Report a usage failure, opened with the tool the caller wrote. */
	fail<T>(message: string): Result<T, SpecError> {
		return failure(new ToolError(`${this.#tool} ${message}`));
	}
}

/** Whether a value compares as a string, which every markup value does. */
function isText(value: Value): value is string | number | boolean {
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

/** The phrase an ordinal opens a description with, e.g. `the 2nd`. */
function ordinalPhrase(at: Ordinal): string {
	if (at === "first") return "the first";
	if (at === "last") return "the last";
	return `the ${ordinalNumber(at)}`;
}

/** An English ordinal for a 1-based position: 1st, 2nd, 3rd, 4th, 11th. */
function ordinalNumber(position: number): string {
	let tens = position % 100;
	if (tens >= 11 && tens <= 13) return `${position}th`;
	let unit = position % 10;
	if (unit === 1) return `${position}st`;
	if (unit === 2) return `${position}nd`;
	if (unit === 3) return `${position}rd`;
	return `${position}th`;
}

/** Quote a name the way every message in this vocabulary quotes one. */
function quote(text: string): string {
	return JSON.stringify(text);
}

/** One optional word parameter, as every tool of this vocabulary declares it. */
function word(name: string, summary: string): ToolParam {
	return { name, kind: "word", required: false, summary };
}
