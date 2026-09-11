/**
 * The built-in `html` capability: read a string of HTML the way a person reads
 * the page it renders. Every tool takes the source as its first argument and
 * parses it in process, so nothing is reached and nothing is granted.
 *
 * It carries what `browser` carries, minus the observables that need a layout,
 * under the addressing vocabulary of `addressing.ts` — so a document is
 * addressed one way, and the namespace says only whether a browser is needed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { HTMLQueryError } from "@sdxc/html";
import type { Result } from "@sdxc/result";

import { HTML, HTMLAmbiguousMatchError } from "@sdxc/html";
import { failure, isFailure, isSuccess, success } from "@sdxc/result";

import type { SpecError } from "../errors.js";
import type { Plugin, ToolContext, ToolDescriptor, ToolParam } from "../plugin.js";
import type { ToolArg, Value } from "../values.js";

import { ExpectationError, ToolError } from "../errors.js";

import type { Assertion, ElementQuery, MatchMode, Predicate, QueryOptions } from "./addressing.js";

import {
	ambiguousMatch,
	ASSERTION_PARAMS,
	describeQuery,
	noMatch,
	parseAssertion,
	parseQuery,
	QUERY_PARAMS,
} from "./addressing.js";

/** The first parameter of every tool: the markup the whole namespace reads. */
const SOURCE_PARAM = {
	name: "source",
	kind: "value",
	required: true,
	summary: "The HTML to read, e.g. the `text` of an `http` response.",
} as const;

/** The accessible name a lookup matches, where the tool's own name fixes the role. */
const NAME_PARAM: ToolParam = {
	name: "name",
	kind: "value",
	required: false,
	summary: "The accessible name, matched whole; `containing` opts into a part of it.",
};

/**
 * What a trailing expected value adds to an element lookup: with no predicate a
 * lookup reads the element's text, so the same shape the head readers take
 * compares against it.
 */
const EXPECTED_PARAMS: ToolParam[] = [
	{
		name: "expected",
		kind: "value",
		required: false,
		summary: "The whole text the element must read; `containing` opts into a part of it.",
	},
	{
		name: "exactly",
		kind: "word",
		required: false,
		summary: "Asserts the element's text equals the string that follows it.",
	},
];

/** The word `html.heading` requires before a heading level. */
const LEVEL_WORDS = ["level"];

/** The word `html.checkbox` takes to assert the box is checked. */
const CHECKED_WORDS = ["checked"];

/** Descriptors of every tool the `html` namespace exposes. */
const HTML_TOOLS: ToolDescriptor[] = [
	{
		name: "title",
		summary: 'Read the document\'s title, or assert it: `html.title page.text "Home"`.',
		kind: "observable",
		params: [
			SOURCE_PARAM,
			{
				name: "expected",
				kind: "value",
				required: false,
				summary: "The whole title the document must carry.",
			},
			...ASSERTION_PARAMS,
		],
	},
	{
		name: "meta",
		summary: 'Read a meta tag\'s content by `name` or `property`: `html.meta src "og:title"`.',
		kind: "observable",
		params: [
			SOURCE_PARAM,
			{
				name: "name",
				kind: "value",
				required: true,
				summary: 'The `name` or `property` the tag carries, e.g. "og:image".',
			},
			{
				name: "expected",
				kind: "value",
				required: false,
				summary: "The whole content the tag must carry.",
			},
			...ASSERTION_PARAMS,
		],
	},
	{
		name: "rel",
		summary: 'Read a `<link>`\'s `href` by one token of its `rel`: `html.rel src "canonical"`.',
		kind: "observable",
		params: [
			SOURCE_PARAM,
			{
				name: "rel",
				kind: "value",
				required: true,
				summary: 'The relationship token to look for, e.g. "canonical".',
			},
			{
				name: "expected",
				kind: "value",
				required: false,
				summary: "The whole href the link must carry.",
			},
			...ASSERTION_PARAMS,
		],
	},
	{
		name: "text",
		summary: "Read the text a reader would see, or assert a substring of it.",
		kind: "observable",
		params: [
			SOURCE_PARAM,
			{
				name: "expected",
				kind: "value",
				required: false,
				summary: "A substring the visible text must contain; `exactly` demands the whole of it.",
			},
			...ASSERTION_PARAMS,
		],
	},
	{
		name: "element",
		summary: 'Address an element by role and accessible name: `html.element src button "Save"`.',
		kind: "observable",
		params: [
			SOURCE_PARAM,
			{
				name: "role",
				kind: "word",
				required: true,
				summary: "The ARIA role, e.g. `button`, `link`, `textbox` — or the word `field`.",
			},
			{
				name: "name",
				kind: "value",
				required: false,
				summary: "The accessible name, matched whole; a `field` takes its `name` attribute.",
			},
			...EXPECTED_PARAMS,
			...QUERY_PARAMS,
		],
	},
	{
		name: "heading",
		summary: 'Address a heading, optionally at a level: `html.heading src "Reports" level 3`.',
		kind: "observable",
		params: [
			SOURCE_PARAM,
			NAME_PARAM,
			{
				name: "level",
				kind: "word",
				required: false,
				summary: "The literal word `level`, introducing the heading level to demand.",
			},
			{
				name: "number",
				kind: "value",
				required: false,
				summary: "The level: 3 matches an `<h3>` or a `role=heading` with `aria-level=3`.",
			},
			...EXPECTED_PARAMS,
			...QUERY_PARAMS,
		],
	},
	{
		name: "link",
		summary: 'Address a link by its accessible name: `html.link src "Profile" first`.',
		kind: "observable",
		params: [SOURCE_PARAM, NAME_PARAM, ...EXPECTED_PARAMS, ...QUERY_PARAMS],
	},
	{
		name: "button",
		summary: 'Address a button by its accessible name: `html.button src "Save" disabled`.',
		kind: "observable",
		params: [SOURCE_PARAM, NAME_PARAM, ...EXPECTED_PARAMS, ...QUERY_PARAMS],
	},
	{
		name: "checkbox",
		summary: 'Assert a checkbox\'s state: `expect html.checkbox src "Remember me" checked`.',
		kind: "observable",
		params: [
			SOURCE_PARAM,
			NAME_PARAM,
			{
				name: "checked",
				kind: "word",
				required: false,
				summary: "Asserts the box is checked; without it the query only addresses the box.",
			},
			...EXPECTED_PARAMS,
			...QUERY_PARAMS,
		],
	},
	{
		name: "cell",
		summary: "Read a table cell: `html.cell src row 1 column 2`, counting from 1 over body rows.",
		kind: "observable",
		params: [SOURCE_PARAM, ...EXPECTED_PARAMS, ...QUERY_PARAMS],
	},
	{
		name: "definition",
		summary: 'Read the definition paired with a term: `html.definition src "Total"`.',
		kind: "observable",
		params: [
			SOURCE_PARAM,
			{
				name: "term",
				kind: "value",
				required: true,
				summary: "The term's text, matched whole.",
			},
			...EXPECTED_PARAMS,
			...QUERY_PARAMS,
		],
	},
];

/** Where an element query starts: after the source every tool reads. */
const AFTER_SOURCE = 1;

/** What a lookup carrying no expected value was asked to do: hand the text back. */
const READ: Assertion = { kind: "read" };

/**
 * Create the built-in `html` plugin (namespace `"html"`). Every tool parses the
 * source it is given and answers from the markup alone, so all are observable
 * and none requires a grant.
 */
export function createHtmlPlugin(): Plugin {
	/**
	 * The document most recently parsed, and the source that produced it. A test
	 * asserts many times over one response, and parsing is the expensive part of
	 * answering, so re-reading the same markup per assertion would make a page's
	 * size cost what the number of assertions multiplies it to.
	 *
	 * Exactly one is held because a parsed document runs about twenty-five times
	 * the size of its source: holding two could raise a run's peak memory, while
	 * holding one never does — the alternative parses the same markup again,
	 * which allocates the same document anyway. A lookup never mutates, so
	 * callers share one safely, and a second source simply replaces the first.
	 */
	let parsed: { source: string; document: HTML } | undefined;
	return {
		namespace: "html",
		describe() {
			return HTML_TOOLS;
		},
		async call(tool, args, context) {
			let answered = answer(
				tool,
				args,
				() => parsed,
				(entry) => void (parsed = entry),
			);
			if (isSuccess(answered)) return answered;
			return failure(await record(answered.error, tool, args, context));
		},
		async dispose() {
			parsed = undefined;
		},
	};
}

/** The document a plugin is holding onto, with the source it was parsed from. */
interface ParsedSource {
	source: string;
	document: HTML;
}

/** Dispatch one call over the parsed document. */
function answer(
	tool: string,
	args: ToolArg[],
	held: () => ParsedSource | undefined,
	hold: (entry: ParsedSource) => void,
): Result<Value, SpecError> {
	let document = parse(tool, args, held, hold);
	if (isFailure(document)) return document;
	let doc = document.data;

	switch (tool) {
		case "title":
			return value(tool, args, AFTER_SOURCE, "exact", "<title>", doc.title);
		case "meta":
			return tagged(tool, args, doc, "meta tag");
		case "rel":
			return tagged(tool, args, doc, "<link rel>");
		case "text":
			return value(tool, args, AFTER_SOURCE, "substring", "visible text", doc.text);
		case "element":
			return element(tool, args, doc, {});
		case "heading":
			return heading(args, doc);
		case "link":
		case "button":
			return element(tool, args, doc, { head: { kind: "role", role: tool } });
		case "checkbox":
			return checkbox(args, doc);
		case "cell":
			return element(tool, args, doc, { head: { kind: "cell" } });
		case "definition":
			return element(tool, args, doc, { head: { kind: "definition" } });
		default: {
			let names = HTML_TOOLS.map((descriptor) => descriptor.name).join(", ");
			return failure(new ToolError(`html has no tool named "${tool}"; tools: ${names}`));
		}
	}
}

/**
 * Parse the source every tool takes first, refusing anything but markup, and
 * answer from the cache when this markup was already read.
 */
function parse(
	tool: string,
	args: ToolArg[],
	held: () => ParsedSource | undefined,
	hold: (entry: ParsedSource) => void,
): Result<HTML, SpecError> {
	let source = args[0];
	if (source === undefined || source.kind !== "value" || typeof source.value !== "string") {
		return failure(
			new ToolError(
				`html.${tool} expects a string of HTML as its first argument, e.g. the \`text\` of an http response`,
			),
		);
	}
	let cached = held();
	if (cached !== undefined && cached.source === source.value) return success(cached.document);
	let document = HTML.parse(source.value);
	if (isFailure(document)) {
		return failure(
			new ToolError(`html.${tool} could not parse the source: ${document.error.message}`),
		);
	}
	hold({ source: source.value, document: document.data });
	return success(document.data);
}

/**
 * `html.meta src "og:image" […]` and `html.rel src "canonical" […]`: one head
 * tag read by its identity. An absent tag names the identities the document
 * does hold, which is the whole diagnosis for a typo.
 */
function tagged(tool: string, args: ToolArg[], doc: HTML, label: string): Result<Value, SpecError> {
	let name = args[1];
	if (name === undefined || name.kind !== "value" || typeof name.value !== "string") {
		let what = tool === "meta" ? "meta tag name" : "rel token";
		return failure(new ToolError(`html.${tool} expects a ${what} as its second argument`));
	}
	let read = tool === "meta" ? doc.meta(name.value) : doc.link(name.value);
	let content = isFailure(read) ? undefined : read.data;
	let available = isFailure(read) ? read.error.available : [];
	return value(
		tool,
		args,
		AFTER_SOURCE + 1,
		"exact",
		`${label} ${JSON.stringify(name.value)}`,
		content,
		available,
	);
}

/**
 * Answer a value-reading observable: hand the value back, report its presence,
 * or assert on it. An absent value is a failed expectation naming what the
 * document holds instead, since `exists` is how a spec asks for the absence.
 */
function value(
	tool: string,
	args: ToolArg[],
	index: number,
	fallback: "exact" | "substring",
	label: string,
	observed: string | undefined,
	available: readonly string[] = [],
): Result<Value, SpecError> {
	let assertion = parseAssertion(`html.${tool}`, args, index, fallback);
	if (isFailure(assertion)) return assertion;
	return assert(tool, label, observed, assertion.data, available);
}

/** Hold the assertion against the value the document carried. */
function assert(
	tool: string,
	label: string,
	observed: string | undefined,
	assertion: Assertion,
	available: readonly string[],
): Result<Value, SpecError> {
	if (assertion.kind === "exists") return success(observed !== undefined && observed !== "");
	if (observed === undefined) {
		let message = `html.${tool} found no ${label} in the document`;
		let present = available.length === 0 ? "" : `. Present: ${available.join(", ")}`;
		let error = new ExpectationError(`${message}${present}`, label, null);
		error.remedy = "Add `exists` where the absence is what the test is about.";
		return failure(error);
	}
	if (assertion.kind === "read") return success(observed);
	let held =
		assertion.mode === "exact" ? observed === assertion.text : observed.includes(assertion.text);
	if (held) return success(true);
	let comparison = assertion.mode === "exact" ? "is not" : "does not contain";
	return failure(
		new ExpectationError(
			`the ${label} ${comparison} ${JSON.stringify(assertion.text)}`,
			assertion.text,
			observed,
		),
	);
}

/** One element lookup: what to look for, what it asserts, and where it stopped. */
interface ElementCall {
	query: ElementQuery;
	predicate: Predicate;
	assertion: Assertion;
	/** Index of the first argument the lookup did not consume. */
	next: number;
}

/**
 * Read an element lookup, which may close with an expected value the way
 * `html.title` and `html.meta` do. A predicate is read first, so an expected
 * value is whatever trails a lookup no predicate claimed.
 */
function parseElement(
	tool: string,
	args: ToolArg[],
	options: QueryOptions,
): Result<ElementCall, SpecError> {
	let settings = { from: AFTER_SOURCE, ...options };
	let direct = parseQuery(tool, args, settings);
	if (isSuccess(direct)) return success({ ...direct.data, assertion: READ });

	/**
	 * `"40%"` and `containing "40"` are one and two arguments long, so trying
	 * both lengths covers every assertion the head readers take. A tail that is
	 * not one of them leaves the predicate's own diagnosis standing.
	 */
	for (let length of [1, 2]) {
		let split = args.length - length;
		if (split <= AFTER_SOURCE) continue;
		let query = parseQuery(tool, args.slice(0, split), settings);
		if (isFailure(query)) continue;
		let assertion = parseAssertion(tool, args, split, "exact");
		if (isFailure(assertion) || assertion.data.kind !== "match") continue;
		return success({ ...query.data, assertion: assertion.data, next: args.length });
	}
	return direct;
}

/**
 * `html.element`, `html.link`, `html.button`, `html.cell` and
 * `html.definition`: one addressed element and what the call asserts about it.
 * With no predicate the element's text is the answer, so the same call reads a
 * value, asserts the element is there, and compares an expected value to it.
 */
function element(
	tool: string,
	args: ToolArg[],
	doc: HTML,
	options: QueryOptions,
): Result<Value, SpecError> {
	let name = `html.${tool}`;
	let parsed = parseElement(name, args, options);
	if (isFailure(parsed)) return parsed;
	return answerElement(name, doc, parsed.data);
}

/** Resolve one parsed lookup against the document and answer what it asked. */
function answerElement(tool: string, doc: HTML, call: ElementCall): Result<Value, SpecError> {
	let { query, predicate } = call;
	if (predicate.kind === "in_viewport") {
		return failure(
			new ToolError(
				`${tool} cannot answer \`in_viewport\`: it reads markup, where nothing is laid out yet. A browser answers that one.`,
			),
		);
	}
	if (predicate.kind === "count") return counted(tool, doc, query, predicate.count);

	let found = look(doc, query);
	/**
	 * `exists` answers presence, so only nothing at all is absent: several
	 * matches still means the thing is there, and reporting `false` would let
	 * `expect not … exists` pass on a page holding two of them.
	 */
	if (predicate.kind === "exists") {
		if (isSuccess(found)) return success(true);
		if (found.error instanceof HTMLAmbiguousMatchError)
			return failure(missed(tool, doc, query, found.error));
		return success(false);
	}
	if (isFailure(found)) return failure(missed(tool, doc, query, found.error));
	if (call.assertion.kind === "match") {
		return reads(query, found.data, call.assertion.text, call.assertion.mode);
	}
	return held(query, found.data, predicate);
}

/**
 * `html.heading […] [level <n>]` — the shared addressing, plus the level
 * clause: 3 matches both an `<h3>` and a `role=heading` with `aria-level=3`,
 * since both reach the accessibility tree identically.
 */
function heading(args: ToolArg[], doc: HTML): Result<Value, SpecError> {
	let options: QueryOptions = { head: { kind: "role", role: "heading" }, stopAt: LEVEL_WORDS };
	let parsed = parseElement("html.heading", args, options);
	if (isFailure(parsed)) return parsed;
	if (args[parsed.data.next] === undefined) return answerElement("html.heading", doc, parsed.data);

	let separator = clauseWord("heading", args, parsed.data.next, LEVEL_WORDS);
	if (isFailure(separator)) return separator;
	let level = levelArg(args, parsed.data.next + 1);
	if (isFailure(level)) return level;
	let found = look(doc, parsed.data.query);
	if (isFailure(found)) return failure(missed("html.heading", doc, parsed.data.query, found.error));
	let observed = headingLevel(found.data);
	if (observed === level.data) return success(true);
	return failure(
		new ExpectationError(
			`${describeQuery(parsed.data.query)} is not at level ${level.data}`,
			level.data,
			observed ?? null,
		),
	);
}

/** A heading's level: the `aria-level` it claims, or the one its tag carries. */
function headingLevel(found: HTML.Element): number | undefined {
	let claimed = Number(found.attributes["aria-level"]);
	if (Number.isInteger(claimed) && claimed > 0) return claimed;
	let tag = /^h([1-6])$/.exec(found.tag);
	return tag === null ? undefined : Number(tag[1]);
}

/** Read a heading level: a positive whole number, nothing else. */
function levelArg(args: ToolArg[], index: number): Result<number, ToolError> {
	let arg = args[index];
	if (
		arg === undefined ||
		arg.kind !== "value" ||
		typeof arg.value !== "number" ||
		!Number.isInteger(arg.value) ||
		arg.value < 1
	) {
		return failure(
			new ToolError(
				`html.heading expects a whole heading level of 1 or more for argument ${index + 1}`,
			),
		);
	}
	return success(arg.value);
}

/**
 * `html.checkbox […] [checked]` — the shared addressing, plus the state clause
 * read from the markup. Without `checked` the call only addresses the box,
 * which is how `count` and the other predicates reach it.
 */
function checkbox(args: ToolArg[], doc: HTML): Result<Value, SpecError> {
	let options: QueryOptions = { head: { kind: "role", role: "checkbox" }, stopAt: CHECKED_WORDS };
	let parsed = parseElement("html.checkbox", args, options);
	if (isFailure(parsed)) return parsed;
	if (args[parsed.data.next] === undefined) return answerElement("html.checkbox", doc, parsed.data);

	let state = clauseWord("checkbox", args, parsed.data.next, CHECKED_WORDS);
	if (isFailure(state)) return state;
	let found = look(doc, parsed.data.query);
	if (isFailure(found))
		return failure(missed("html.checkbox", doc, parsed.data.query, found.error));
	if (found.data.attributes["checked"] !== undefined) return success(true);
	return failure(
		new ExpectationError(`${describeQuery(parsed.data.query)} is not checked`, true, false),
	);
}

/** Take the word a trailing clause opens with, e.g. the `level` of a heading. */
function clauseWord(
	tool: string,
	args: ToolArg[],
	index: number,
	accepted: readonly string[],
): Result<string, SpecError> {
	let arg = args[index];
	if (arg === undefined || arg.kind !== "word" || !accepted.includes(arg.word)) {
		let words = accepted.map((word) => `\`${word}\``).join(" or ");
		return failure(
			new ToolError(`html.${tool} expects the word ${words} as argument ${index + 1}`),
		);
	}
	return success(arg.word);
}

/** Run the lookup the query's kind selects, mapping it onto the package's own. */
function look(doc: HTML, query: ElementQuery): Result<HTML.Element, HTMLQueryError> {
	if (query.kind === "field") {
		return doc.field(query.field ?? "", { value: query.value, at: query.at });
	}
	if (query.kind === "definition") return doc.definition(query.term ?? "", { at: query.at });
	if (query.kind === "cell") {
		let cell = query.cell ?? { row: 1, column: 1, includeHeader: false };
		return doc.cell({
			row: cell.row,
			column: cell.column,
			includeHeader: cell.includeHeader,
			at: query.at,
		});
	}
	return doc.query({
		role: query.role,
		name: query.name,
		nameContaining: query.nameContaining,
		at: query.at,
	});
}

/**
 * Hold an expected value against the text the element reads — the comparison a
 * binding and a later `expect` make, written as one call.
 */
function reads(
	query: ElementQuery,
	found: HTML.Element,
	expected: string,
	mode: MatchMode,
): Result<Value, SpecError> {
	let matched = mode === "exact" ? found.text === expected : found.text.includes(expected);
	if (matched) return success(true);
	let comparison = mode === "exact" ? "not" : "which does not contain";
	return failure(
		new ExpectationError(
			`${describeQuery(query)} reads ${JSON.stringify(found.text)}, ${comparison} ${JSON.stringify(expected)}`,
			expected,
			found.text,
		),
	);
}

/** Hold a predicate against the one element the query resolved to. */
function held(
	query: ElementQuery,
	found: HTML.Element,
	predicate: Predicate,
): Result<Value, SpecError> {
	if (predicate.kind === "present") return success(found.text);
	if (predicate.kind === "value") {
		if ((found.value ?? "") === predicate.value) return success(true);
		return failure(
			new ExpectationError(
				`${describeQuery(query)} carries the value ${JSON.stringify(found.value ?? "")}, not ${JSON.stringify(predicate.value)}`,
				predicate.value,
				found.value ?? null,
			),
		);
	}
	if (predicate.kind === "attribute") {
		let observed = found.attributes[predicate.name];
		if (observed === predicate.value) return success(true);
		let present = Object.keys(found.attributes).join(", ");
		let carried =
			observed === undefined
				? `carries no ${predicate.name} attribute; it carries: ${present}`
				: `carries ${predicate.name}=${JSON.stringify(observed)}`;
		return failure(
			new ExpectationError(
				`${describeQuery(query)} ${carried}, not ${JSON.stringify(predicate.value)}`,
				predicate.value,
				observed ?? null,
			),
		);
	}
	if (predicate.kind === "state") {
		if (found.disabled !== predicate.enabled) return success(true);
		let wanted = predicate.enabled ? "enabled" : "disabled";
		return failure(
			new ExpectationError(
				`${describeQuery(query)} is not ${wanted}`,
				wanted,
				found.disabled ? "disabled" : "enabled",
			),
		);
	}
	return success(true);
}

/** Count what the query matched, the one predicate that takes a set. */
function counted(
	tool: string,
	doc: HTML,
	query: ElementQuery,
	expected: number,
): Result<Value, SpecError> {
	let matches =
		query.kind === "field"
			? doc.queryAll().filter((found) => found.attributes["name"] === query.field)
			: doc.queryAll({
					role: query.role,
					name: query.name,
					nameContaining: query.nameContaining,
				});
	if (matches.length === expected) return success(true);
	return failure(
		new ExpectationError(
			`${tool} found ${matches.length} matches for ${describeQuery(query)}, not ${expected}`,
			expected,
			matches.length,
		),
	);
}

/**
 * Put a lookup's failure into the shared vocabulary: several matches ask which
 * one, and no match names what the document held under the same lookup and
 * which roles carry the name that was asked for.
 */
function missed(tool: string, doc: HTML, query: ElementQuery, error: HTMLQueryError): SpecError {
	if (error instanceof HTMLAmbiguousMatchError) {
		return ambiguousMatch(tool, query, error.candidates);
	}
	if (query.kind === "cell" || query.kind === "definition") {
		let reported = new ExpectationError(
			`${tool} could not read ${describeQuery(query)}: ${error.message}`,
			describeQuery(query),
			null,
		);
		reported.remedy = "Add `exists` where the absence is what the test is about.";
		return reported;
	}
	return noMatch(tool, query, { names: error.available, roles: rolesCarrying(doc, query) });
}

/**
 * The roles carrying the name that was asked for — the same name under the
 * wrong role, which is half of the near-match diagnosis. Generic elements are
 * left out: a wrapper inherits the name of what it wraps.
 */
function rolesCarrying(doc: HTML, query: ElementQuery): string[] {
	if (query.kind !== "role" || query.name === undefined) return [];
	let roles = new Set<string>();
	for (let found of doc.queryAll({ name: query.name })) {
		if (found.role === undefined || found.role === "generic") continue;
		if (found.role === query.role) continue;
		roles.add(found.role);
	}
	return [...roles];
}

/**
 * Leave the document a failure was read from in the artifacts directory, so a
 * report says what the page actually held. A run without `--artifacts` keeps
 * its diagnostics text, and a failed write never worsens a failure.
 */
async function record(
	error: SpecError,
	tool: string,
	args: ToolArg[],
	context: ToolContext,
): Promise<SpecError> {
	let source = args[0];
	if (context.artifacts === undefined) return error;
	if (source === undefined || source.kind !== "value" || typeof source.value !== "string") {
		return error;
	}
	let path = await context.artifacts.write(`html-${tool}-${context.run.nonce}.html`, source.value);
	if (path === undefined) return error;
	error.artifacts = [...(error.artifacts ?? []), path];
	return error;
}
