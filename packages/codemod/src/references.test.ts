/**
 * What `findModuleReferences` reports for each declaration form: kinds, bound names with their
 * aliases and `type` modifiers, listed calls, and the declarations it refuses to guess about.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import { findModuleReferences } from "./index.js";

/** Each reference as `kind specifier [names]`, the shape most assertions here need. */
function summary(filename: string, source: string, calls: string[] = []): string[] {
	return unwrap(findModuleReferences(filename, source, { calls })).map((reference) => {
		let names = reference.names.map(
			(name) =>
				`${name.typeOnly ? "type " : ""}${name.imported}${name.local === name.imported ? "" : ` as ${name.local}`}`,
		);
		return `${reference.kind}${reference.typeOnly ? " type" : ""} ${reference.specifier} [${names.join(", ")}]`;
	});
}

describe("findModuleReferences", () => {
	test("reports imports with the names they bind", () => {
		let source = [
			'import "./side-effect.js";',
			'import React, { useState as state, type FC } from "react";',
			'import * as path from "node:path";',
			'import type { Config } from "./config.js";',
		].join("\n");

		expect(summary("a.ts", source)).toEqual([
			"import ./side-effect.js []",
			"import react [default as React, useState as state, type FC]",
			"import node:path [* as path]",
			"import type ./config.js [type Config]",
		]);
	});

	test("reports re-exports and skips exports of local bindings", () => {
		let source = [
			"let local = 1;",
			"export { local };",
			'export * from "./all.js";',
			'export * as ns from "./ns.js";',
			'export { a, b as c } from "./named.js";',
			'export type { T } from "./types.js";',
		].join("\n");

		expect(summary("a.ts", source)).toEqual([
			"export ./all.js []",
			"export ./ns.js [* as ns]",
			"export ./named.js [a, b as c]",
			"export type ./types.js [type T]",
		]);
	});

	test("reports dynamic imports and listed calls with a string literal, anywhere", () => {
		let source = [
			'vi.mock("./mocked.js");',
			"function load(name: string) {",
			'\treturn [import("./page.js"), import(name), require("./legacy.cjs")];',
			"}",
			'type Lazy = typeof import("./types.js");',
		].join("\n");

		expect(summary("a.ts", source, ["vi.mock", "require"])).toEqual([
			"call ./mocked.js []",
			"dynamic ./page.js []",
			"call ./legacy.cjs []",
		]);
	});

	test("reports TypeScript import types as type-only dynamic references when asked", () => {
		let source = [
			'type Lazy = typeof import("./lazy.js");',
			'let value: import("./types.js").Value;',
			'let page = await import("./page.js");',
		].join("\n");

		let references = unwrap(findModuleReferences("a.d.ts", source, { importTypes: true }));

		expect(references.map((reference) => [reference.specifier, reference.typeOnly])).toEqual([
			["./lazy.js", true],
			["./types.js", true],
			["./page.js", false],
		]);
	});

	test("ignores specifiers in JSX text, strings, template literals and comments", () => {
		let source = [
			'// import "./comment.js";',
			"let text = 'import \"./string.js\"';",
			'let template = `import("./template.js")`;',
			'let page = <p>Don\'t import "./jsx.js"</p>;',
		].join("\n");

		expect(summary("a.tsx", source)).toEqual([]);
	});

	test("carries the ranges an edit replaces and resolves escapes in the specifier", () => {
		let source = 'import { a } from "./\\u0061.js";';
		let [reference] = unwrap(findModuleReferences("a.ts", source));

		expect(reference?.specifier).toBe("./a.js");
		expect(source.slice(reference?.specifierRange.start, reference?.specifierRange.end)).toBe(
			'"./\\u0061.js"',
		);
		expect(reference?.range).toEqual({ start: 0, end: source.length });
		expect(source.slice(reference?.braces?.start, reference?.braces?.end)).toBe("{ a }");
	});

	test("fails on an import declaration outside the grammar", () => {
		let result = findModuleReferences("a.ts", 'import { a b } from "./x.js";');

		expect(isFailure(result) && result.error.code).toBe("invalid-declaration");
	});

	test("fails on a file it cannot scan", () => {
		let result = findModuleReferences("a.ts", 'import { a } from "./x.js');

		expect(isFailure(result) && result.error.code).toBe("unterminated");
	});
});
