/**
 * Reads a string of markup into a document, wrapping a fragment in the skeleton a
 * page carries so a partial response is queried the same way a full one is, and
 * failing on a source whose only content is whitespace.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";
import { parseHTML } from "linkedom";

import { HTMLParseError } from "../index.js";

import type { DOMDocument } from "./dom.js";

import { visibleText } from "./text.js";

/** Elements a document always carries, whose presence alone says nothing was parsed. */
const SKELETON_TAGS = new Set(["body", "head", "html"]);

/**
 * Parses markup into a document.
 *
 * @param source - The markup to read, a full page or a fragment of one
 * @returns The document, or the failure a source carrying no markup produces
 */
export function parseDocument(source: string): Result<DOMDocument, HTMLParseError> {
	let document = parseHTML(wrap(source)).document as unknown as DOMDocument;

	let elements = Array.from(document.querySelectorAll("*")).filter((element) => {
		return !SKELETON_TAGS.has(element.localName.toLowerCase());
	});

	if (elements.length === 0 && visibleText(document.body).length === 0) {
		return failure(new HTMLParseError("Expected markup, received a source carrying none."));
	}

	return success(document);
}

/**
 * Gives a fragment the document skeleton it lacks, since a parser handed one places
 * the implied `<head>` and `<body>` inside the fragment's first element instead.
 */
function wrap(source: string): string {
	if (/<(?:html|body)[\s>]/iu.test(source)) return source;
	return `<!doctype html><html><head></head><body>${source}</body></html>`;
}
