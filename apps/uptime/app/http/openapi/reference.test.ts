/**
 * Tests the generated API reference: a placeholder expands into the operation's scope,
 * error table and schema blocks, an unknown name fails, and the reference pages name
 * every operation in the document exactly once, so no endpoint goes undocumented.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { isFailure } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { buildApiDocument } from "~/app/http/openapi/document";
import { expandReference, referencedOperations } from "~/app/http/openapi/reference";

/** The API reference's Markdown sources, which the docs site bundles. */
const API_DOCS = join(import.meta.dirname, "../../../resources/docs/api");

/** Every Markdown file under `directory`, recursively. */
function markdownFiles(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		let path = join(directory, entry.name);
		if (entry.isDirectory()) return markdownFiles(path);
		return entry.name.endsWith(".md") ? [path] : [];
	});
}

describe("expandReference", () => {
	test("renders an operation's scope, errors and schemas in place of its placeholder", () => {
		let result = expandReference("## Show\n\n<!-- operation: monitorShow -->\n\nAfter.");
		if (isFailure(result)) return expect.unreachable(result.error.message);

		expect(result.data).toContain("**Required scope:** `monitors:read`");
		expect(result.data).toContain("| 404 | `not-found` | The resource does not exist |");
		expect(result.data).toContain("### Response Schema\n\n```json");
		expect(result.data).toContain('"$ref": "#/$defs/Monitor"');
		expect(result.data).toMatch(/After\.$/);
	});

	test("renders the problem-types table", () => {
		let result = expandReference("<!-- problem-types -->");
		if (isFailure(result)) return expect.unreachable(result.error.message);

		expect(result.data).toContain(
			"| 422 | `idempotency-key-reused` | This idempotency key was already used for a different request |",
		);
	});

	test("fails on a placeholder naming no operation", () => {
		let result = expandReference("<!-- operation: noSuchOperation -->");
		expect(isFailure(result) && result.error.message).toBe(
			"No API operation named noSuchOperation",
		);
	});

	test("leaves a page without placeholders untouched", () => {
		expect(expandReference("# Plain page")).toEqual({ status: "success", data: "# Plain page" });
	});
});

describe("the API reference pages", () => {
	let pages = markdownFiles(API_DOCS).map((path) => ({
		path,
		content: readFileSync(path, "utf8"),
	}));

	test("every page's placeholders expand", () => {
		let failures = pages.flatMap((page) => {
			let result = expandReference(page.content);
			return isFailure(result) ? [`${page.path}: ${result.error.message}`] : [];
		});
		expect(failures).toEqual([]);
	});

	test("name every operation in the document exactly once", () => {
		let named = pages.flatMap((page) => referencedOperations(page.content));
		let operations = buildApiDocument()
			.operations()
			.map((operation) => operation.operationId);

		expect(operations.filter((name) => !named.includes(name))).toEqual([]);
		expect(named.filter((name, index) => named.indexOf(name) !== index)).toEqual([]);
	});
});
