/**
 * Reads a chapter body through `@sdxc/xml` and walks the tree once: it refuses what EPUB
 * content documents may not hold, records the ids a fragment may target and the references
 * the publication must satisfy, and derives the manifest properties the content calls for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";
import { XML } from "@sdxc/xml";

import { EpubContentError } from "./errors.js";

/** The XHTML namespace every content document's elements belong to. */
export const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

/** The namespace of `epub:type` and the other EPUB structural attributes. */
export const EPUB_NAMESPACE = "http://www.idpf.org/2007/ops";

/** C0 controls other than tab, line feed and carriage return, which XML 1.0 forbids. */
// oxlint-disable-next-line no-control-regex -- control characters are what this finds
const CONTROL_CHARACTER = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u;

/**
 * Whether a string holds a character an XML document may not contain: a C0 control other
 * than tab, line feed and carriage return, U+FFFE, U+FFFF, or a lone surrogate (iterating by
 * code point yields a paired surrogate as one character above U+FFFF).
 */
export function hasForbiddenCharacter(value: string): boolean {
	if (CONTROL_CHARACTER.test(value)) return true;
	for (let character of value) {
		let code = character.codePointAt(0) ?? 0;
		if (code === 0xfffe || code === 0xffff || (code >= 0xd800 && code <= 0xdfff)) return true;
	}
	return false;
}

/**
 * One reference in a body. A `resource` is loaded into the page (an image, a stylesheet, a
 * font) and must be in the publication; a `link` is followed by the reader and may leave it.
 */
export interface Reference {
	kind: "resource" | "link";
	value: string;
}

/** A body that passed every content rule, with what the rest of the build checks against. */
export interface ParsedBody {
	/** The body's nodes, entities resolved, ready to place inside the document's `<body>`. */
	nodes: XML.Node[];
	ids: Set<string>;
	references: Reference[];
	/** `svg` and `mathml`, as the manifest item must declare them. */
	properties: Set<string>;
}

/**
 * Parses a chapter body and verifies it. The body is wrapped in a `<body>` declaring the
 * XHTML and `epub` namespaces, so `epub:type` works without a declaration of its own, and
 * whitespace is preserved so `<pre>` blocks and the spaces between inline elements survive.
 *
 * @param chapter - The chapter id, named in every error
 * @param body - The XHTML that goes inside `<body>`
 * @returns The parsed body, or an `EpubContentError` for the first rule it breaks
 */
export function parseBody(chapter: string, body: string): Result<ParsedBody, EpubContentError> {
	let parsed = XML.parse(
		`<body xmlns="${XHTML_NAMESPACE}" xmlns:epub="${EPUB_NAMESPACE}">${body}</body>`,
		{ whitespace: "preserve" },
	);
	if (parsed.status === "failure") {
		return failure(
			new EpubContentError(
				`Chapter "${chapter}" is not well-formed XML: ${parsed.error.message}`,
				chapter,
				{
					cause: parsed.error,
				},
			),
		);
	}

	let result: ParsedBody = {
		nodes: parsed.data.root.children ?? [],
		ids: new Set(),
		references: [],
		properties: new Set(),
	};
	for (let node of result.nodes) {
		let problem = visit(node, result);
		if (problem) return failure(new EpubContentError(`Chapter "${chapter}" ${problem}`, chapter));
	}
	return success(result);
}

/**
 * Checks one node and everything under it, recording ids, references and properties on the
 * way down.
 *
 * @returns What the node holds that a content document may not, completing "Chapter … "
 */
function visit(node: XML.Node, result: ParsedBody): string | undefined {
	if (typeof node === "string") {
		return hasForbiddenCharacter(node) ? "contains a character XML forbids" : undefined;
	}

	let element = localName(node.name);
	if (element === "script")
		return "contains <script>, which an EPUB with no scripted content may not hold";
	if (element === "form") return "contains <form>, which reading systems cannot submit";
	if (element === "svg") result.properties.add("svg");
	if (element === "math") result.properties.add("mathml");

	for (let [name, value] of Object.entries(node.attributes ?? {})) {
		let attribute = localName(name);
		if (hasForbiddenCharacter(value)) return `has a character XML forbids in "${name}"`;
		if (/^on/i.test(attribute)) return `has an event handler attribute "${name}"`;
		if (name === "id" || name === "xml:id") {
			if (result.ids.has(value)) return `uses the id "${value}" twice`;
			result.ids.add(value);
		}
		result.references.push(...referencesOf(element, name, attribute, value));
	}

	for (let child of node.children ?? []) {
		let problem = visit(child, result);
		if (problem) return problem;
	}
	return undefined;
}

/**
 * The references one attribute makes. `href` is a link on `<a>` and `<area>` and a resource
 * on `<link>` and SVG's `<image>` and `<use>`; `src`, `poster`, `data` and every `srcset`
 * candidate are resources.
 */
function referencesOf(
	element: string,
	name: string,
	attribute: string,
	value: string,
): Reference[] {
	if (attribute === "href" && (name === "href" || name.endsWith(":href"))) {
		if (element === "a" || element === "area") return [{ kind: "link", value }];
		if (element === "link" || element === "image" || element === "use") {
			return [{ kind: "resource", value }];
		}
		return [];
	}
	if (name === "src" || name === "poster" || (name === "data" && element === "object")) {
		return [{ kind: "resource", value }];
	}
	if (name === "srcset") {
		return value
			.split(",")
			.map((candidate) => candidate.trim().split(/\s+/u)[0] ?? "")
			.filter((candidate) => candidate.length > 0)
			.map((candidate) => ({ kind: "resource", value: candidate }));
	}
	return [];
}

/** A qualified name without its prefix, so `svg:svg` and `svg` are both the SVG root. */
function localName(name: string): string {
	let separator = name.indexOf(":");
	return separator === -1 ? name : name.slice(separator + 1);
}
