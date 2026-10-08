/**
 * Renders every CommonMark and GFM example with `syntax: "xhtml"` and parses the
 * result as XML, so each node type the specifications exercise is proven to
 * reach an XML consumer, such as an EPUB reader, as a well-formed fragment.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { readFileSync } from "node:fs";

import { isFailure } from "@sdxc/result";
import { XML } from "@sdxc/xml";
import { describe, expect, test } from "vitest";

import { toHTML } from "../html/index.js";
import { Markdown } from "../index.js";

/** The fields of a vendored example this suite reads. */
interface Example {
	markdown: string;
	example: number;
	section: string;
}

/** An example whose rendering an XML parser rejected, with the reason it gave. */
interface Rejection {
	example: number;
	section: string;
	reason: string;
}

/** Reads a vendored example set from `docs/vendor`, where the specifications sit. */
function load(path: string): Example[] {
	return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8")) as Example[];
}

const COMMONMARK = load("../../../../docs/vendor/commonmark/spec.json");

const GFM = load("../../../../docs/vendor/gfm/spec.json");

/** Both suites parse well over a thousand documents, which the default budget cuts short. */
const SUITE_TIMEOUT_MS = 120_000;

/**
 * Characters outside XML 1.0's `Char` production, lone surrogates included,
 * which the parser accepts but a validating reader rejects.
 */
// oxlint-disable-next-line no-control-regex -- matching the control characters XML 1.0 forbids is the point
const FORBIDDEN_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF\uD800-\uDFFF]/u;

/**
 * Wraps the rendering in one root element, since a document holds several
 * blocks and XML requires a single root. A source the parser rejects has no
 * markup to check, so it reads as the parser's own reason.
 */
function check(example: Example): Rejection | null {
	let parsed = Markdown.parse(example.markdown);
	if (isFailure(parsed)) {
		return { example: example.example, section: example.section, reason: parsed.error.message };
	}

	let html = toHTML(parsed.data.document, { syntax: "xhtml" });
	let forbidden = FORBIDDEN_CHARACTERS.exec(html);
	if (forbidden) {
		let code = forbidden[0].codePointAt(0)?.toString(16).toUpperCase();
		return { example: example.example, section: example.section, reason: `U+${code} in output` };
	}

	let result = XML.parse(`<div>${html}</div>`);
	if (isFailure(result)) {
		return { example: example.example, section: example.section, reason: result.error.message };
	}

	return null;
}

/** Names every rejected example, so the assertion message alone says what to fix. */
function rejections(examples: Example[]): string[] {
	return examples
		.map(check)
		.filter((rejection) => rejection !== null)
		.map((rejection) => `${rejection.example} (${rejection.section}): ${rejection.reason}`);
}

describe("xhtml output", () => {
	test(
		"parses as XML for every CommonMark example",
		() => {
			expect(rejections(COMMONMARK)).toEqual([]);
		},
		SUITE_TIMEOUT_MS,
	);

	test(
		"parses as XML for every GFM example",
		() => {
			expect(rejections(GFM)).toEqual([]);
		},
		SUITE_TIMEOUT_MS,
	);
});
