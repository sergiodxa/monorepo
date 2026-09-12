/**
 * Covers the two entry points over one options object: that both read the same
 * frontmatter block, that reading the frontmatter alone never touches the body,
 * and which half of a document a failure comes from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import type { Markdown } from "../index.js";

import { MarkdownParseError } from "./errors.js";
import { parseDocument, parseFrontmatter } from "./parse.js";

/** The frontmatter every schema fixture validates against. */
const SCHEMA = s.object({ title: s.string() });

/** A tag registered so the block phase has something to recognize. */
const TAGS: NonNullable<Markdown.Options["tags"]> = { note: {} };

/** A document whose frontmatter validates and whose body holds one heading. */
const DOCUMENT = "---\ntitle: Hi\n---\n# Body\n";

/** A document whose frontmatter fails its schema and whose body would fail too. */
const BOTH_BROKEN = "---\ntitle: 42\n---\n<note>\n";

/**
 * @param result - What an entry point answered
 * @returns The failure it carries, failing the test when it succeeded
 */
function rejected(result: Result<unknown, MarkdownParseError>): MarkdownParseError {
	if (!isFailure(result)) throw new Error("Expected the source to be rejected");
	return result.error;
}

describe("parseDocument", () => {
	test("answers with the frontmatter and the body of one source", () => {
		let parsed = unwrap(parseDocument(DOCUMENT, { frontmatter: SCHEMA }));

		expect(parsed.frontmatter).toEqual({ title: "Hi" });
		expect(parsed.document.children.map((child) => child.type)).toEqual(["heading"]);
	});

	test("reads a source with no frontmatter block as an empty one", () => {
		let parsed = unwrap(parseDocument("# Body\n", {}));

		expect(parsed.frontmatter).toEqual({});
		expect(parsed.document.children.map((child) => child.type)).toEqual(["heading"]);
	});

	test("positions the body against the source, frontmatter lines included", () => {
		let parsed = unwrap(parseDocument(DOCUMENT, { frontmatter: SCHEMA }));

		expect(parsed.document.children[0]?.position.start.line).toBe(4);
	});

	test("registers the caller's tags for the block phase", () => {
		let parsed = unwrap(parseDocument("<note>\nInside.\n</note>\n", { tags: TAGS }));

		expect(parsed.document.children[0]).toMatchObject({ type: "tag", name: "note" });
	});

	test("leaves an unregistered name to the body, where it is not a tag", () => {
		let parsed = unwrap(parseDocument("<note>\nInside.\n</note>\n", {}));

		expect(parsed.document.children[0]?.type).not.toBe("tag");
	});

	test("fails with the schema's issues when the frontmatter is invalid", () => {
		let error = rejected(parseDocument("---\ntitle: 42\n---\n# Body\n", { frontmatter: SCHEMA }));

		expect(error).toBeInstanceOf(MarkdownParseError);
		expect(error.issues.length).toBeGreaterThan(0);
	});

	test("fails with the line a frontmatter block YAML cannot read", () => {
		let error = rejected(parseDocument("---\ntitle: Hi\n\tbroken: true\n---\n# Body\n", {}));

		expect(error.position?.start.line).toBe(3);
	});

	test("surfaces a failure the body raised, carrying no schema issues", () => {
		let error = rejected(parseDocument("<note>\n", { tags: TAGS }));

		expect(error).toBeInstanceOf(MarkdownParseError);
		expect(error.issues).toEqual([]);
		expect(error.position?.start.line).toBe(1);
	});

	test("stops at the invalid frontmatter rather than reaching the body that also fails", () => {
		let error = rejected(parseDocument(BOTH_BROKEN, { frontmatter: SCHEMA, tags: TAGS }));

		expect(error.issues.length).toBeGreaterThan(0);
	});
});

describe("parseFrontmatter", () => {
	test("answers with the frontmatter alone, leaving no document behind", () => {
		let read = unwrap(parseFrontmatter(DOCUMENT, { frontmatter: SCHEMA }));

		expect(Object.keys(read)).toEqual(["frontmatter"]);
		expect(read.frontmatter).toEqual({ title: "Hi" });
	});

	test("reads the same block the whole-document entry point reads", () => {
		let options = { frontmatter: SCHEMA };

		expect(unwrap(parseFrontmatter(DOCUMENT, options)).frontmatter).toEqual(
			unwrap(parseDocument(DOCUMENT, options)).frontmatter,
		);
	});

	test("reads a source with no frontmatter block as an empty one", () => {
		expect(unwrap(parseFrontmatter("# Body\n", {})).frontmatter).toEqual({});
	});

	test("answers over a body that would fail to parse, having never read it", () => {
		expect(isSuccess(parseFrontmatter("---\ntitle: Hi\n---\n<note>\n", { tags: TAGS }))).toBe(true);
		expect(isFailure(parseDocument("---\ntitle: Hi\n---\n<note>\n", { tags: TAGS }))).toBe(true);
	});

	test("fails with the schema's issues when the frontmatter is invalid", () => {
		let error = rejected(parseFrontmatter(BOTH_BROKEN, { frontmatter: SCHEMA, tags: TAGS }));

		expect(error).toBeInstanceOf(MarkdownParseError);
		expect(error.issues.length).toBeGreaterThan(0);
	});

	test("fails with the line a frontmatter block YAML cannot read", () => {
		let error = rejected(parseFrontmatter("---\ntitle: Hi\n\tbroken: true\n---\n", {}));

		expect(error.position?.start.line).toBe(3);
	});
});
