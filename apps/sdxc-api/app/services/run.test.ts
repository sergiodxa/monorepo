/**
 * Unit tests for catalog operation runners.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import { runOperation } from "./run";

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

	test("refuses an unknown operation", async () => {
		let result = await runOperation("nope", {});
		expect(isFailure(result)).toBe(true);
	});
});
