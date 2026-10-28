/**
 * Unit tests for catalog operation runners.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { runOperation } from "./run";

/** Inter Regular fixture used by `@sdxc/pdf` tests — small enough for `pdf.build`. */
const INTER_TTF = readFileSync(
	join(import.meta.dirname, "../../../../packages/font/src/fixtures/inter-regular.ttf"),
);

describe("runOperation", () => {
	test("encodes a QR symbol", async () => {
		let result = await runOperation("qr.encode", { text: "https://sdxc.dev" });
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			let body = result.data as { svgPath: string; size: number };
			expect(body.svgPath.length).toBeGreaterThan(0);
			expect(body.size).toBeGreaterThan(0);
		}
	});

	test("tokenizes TypeScript", async () => {
		let result = await runOperation("highlight", {
			source: "const x = 1;",
			language: "typescript",
		});
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			let body = result.data as { tokens: unknown[] };
			expect(body.tokens.length).toBeGreaterThan(0);
		}
	});

	test("flattens markdown", async () => {
		let result = await runOperation("markdown.plain", {
			markdown: "# Hello\n\nSome **bold** text.",
		});
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect((result.data as { text: string }).text).toContain("Hello");
			expect((result.data as { text: string }).text).toContain("bold");
		}
	});

	test("checks semver caret", async () => {
		let result = await runOperation("semver.satisfies", {
			version: "1.4.0",
			comparison: "^",
			against: "1.2.3",
		});
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect((result.data as { satisfies: boolean }).satisfies).toBe(true);
		}
	});

	test("parses a zone file", async () => {
		let result = await runOperation("zone-file.parse", {
			zone: "www 300 IN A 192.0.2.1\n",
			origin: "example.com",
		});
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			let body = result.data as { records: unknown[] };
			expect(body.records.length).toBe(1);
		}
	});

	test("applies a JSON patch", async () => {
		let result = await runOperation("json-patch.apply", {
			document: { tags: ["a"] },
			patch: [{ op: "add", path: "/tags/-", value: "b" }],
		});
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect((result.data as { document: { tags: string[] } }).document.tags).toEqual(["a", "b"]);
		}
	});

	test("diffs JSON values", async () => {
		let result = await runOperation("json-patch.diff", {
			before: { a: 1 },
			after: { a: 2 },
		});
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			expect((result.data as { patch: unknown[] }).patch.length).toBeGreaterThan(0);
		}
	});

	test("builds a one-page PDF from text and a font", async () => {
		let result = await runOperation("pdf.build", {
			title: "Note",
			text: "Hello from api.sdxc.dev",
			fontBase64: Buffer.from(INTER_TTF).toString("base64"),
		});
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			let body = result.data as { mediaType: string; encoding: string; bytes: string };
			expect(body.mediaType).toBe("application/pdf");
			expect(body.encoding).toBe("base64");
			expect(body.bytes.startsWith("JVBERi")).toBe(true);
		}
	});

	test("builds an EPUB from metadata and chapters", async () => {
		let result = await runOperation("epub.build", {
			metadata: {
				identifier: "urn:uuid:5f1c2a86-3b1e-4f0c-9d55-0a4e7b1c2d3e",
				title: "A Short Book",
				language: "en",
				modified: "2026-10-08T00:00:00Z",
			},
			chapters: [{ id: "one", title: "Chapter One", body: "<h1>Chapter One</h1><p>Hello.</p>" }],
		});
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			let body = result.data as { mediaType: string; bytes: string; byteLength: number };
			expect(body.mediaType).toBe("application/epub+zip");
			expect(body.byteLength).toBeGreaterThan(0);
			expect(body.bytes.length).toBeGreaterThan(0);
		}
	});

	test("normalizes feed source text", async () => {
		let result = await runOperation("feed.normalize", {
			source: [
				'<?xml version="1.0"?>',
				'<rss version="2.0"><channel>',
				"<title>Example</title>",
				"<link>https://example.com/</link>",
				"<description>Demo feed</description>",
				"<item><title>Hi</title><guid>1</guid><link>https://example.com/hi</link></item>",
				"</channel></rss>",
			].join(""),
		});
		expect(isSuccess(result)).toBe(true);
		if (isSuccess(result)) {
			let body = result.data as { format: string; title: string; items: unknown[] };
			expect(body.format).toBe("rss");
			expect(body.title).toBe("Example");
			expect(body.items.length).toBe(1);
		}
	});

	test("refuses an unknown operation", async () => {
		let result = await runOperation("nope", {});
		expect(isFailure(result)).toBe(true);
	});
});
