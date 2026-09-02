/**
 * Tests the TypeScript grammar: the keywords, builtin types, decorators and
 * type arguments it adds, and the JavaScript constructs it keeps painting.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { scan } from "../lexer";

import { typescript } from "./typescript";

describe("typescript", () => {
	test("paints a declared type and the builtin it is made of", () => {
		let tokens = scan("interface U { id: string }", typescript);

		expect(tokens).toEqual([
			{ type: "keyword", value: "interface" },
			{ type: "plain", value: " " },
			{ type: "class-name", value: "U" },
			{ type: "plain", value: " " },
			{ type: "punctuation", value: "{" },
			{ type: "plain", value: " " },
			{ type: "property", value: "id" },
			{ type: "operator", value: ":" },
			{ type: "plain", value: " " },
			{ type: "builtin", value: "string" },
			{ type: "plain", value: " " },
			{ type: "punctuation", value: "}" },
		]);
	});

	test("paints the words TypeScript adds as keywords", () => {
		let code =
			"declare namespace N { enum E {} }\nabstract class A implements B { protected override readonly id = 1 }\ntype T = { a: 1 } satisfies X;\ntype K<V> = keyof V;\ntype I<V> = V extends Array<infer E> ? E : never;\nfunction f(v: unknown): asserts v is string {}\nlet m = module;";
		let keywords = scan(code, typescript)
			.filter((token) => token.type === "keyword")
			.map((token) => token.value);

		expect(keywords).toEqual([
			"declare",
			"namespace",
			"enum",
			"abstract",
			"class",
			"implements",
			"protected",
			"override",
			"readonly",
			"type",
			"satisfies",
			"type",
			"keyof",
			"type",
			"extends",
			"infer",
			"function",
			"asserts",
			"is",
			"let",
			"module",
		]);
	});

	test("paints every type the language provides as a builtin", () => {
		let code =
			"type Every = any | bigint | boolean | never | number | object | string | symbol | unknown | void;";
		let builtins = scan(code, typescript)
			.filter((token) => token.type === "builtin")
			.map((token) => token.value);

		expect(builtins).toEqual([
			"any",
			"bigint",
			"boolean",
			"never",
			"number",
			"object",
			"string",
			"symbol",
			"unknown",
			"void",
		]);
	});

	test("reads a word after a dot as a member rather than a keyword", () => {
		let tokens = scan("u.is(2)", typescript);

		expect(tokens).toEqual([
			{ type: "plain", value: "u" },
			{ type: "punctuation", value: "." },
			{ type: "function", value: "is" },
			{ type: "punctuation", value: "(" },
			{ type: "number", value: "2" },
			{ type: "punctuation", value: ")" },
		]);
	});

	test("reads a word before a colon as a key rather than a keyword", () => {
		let tokens = scan('{ type: "page", number: 1 }', typescript);

		expect(tokens).toContainEqual({ type: "property", value: "type" });
		expect(tokens).toContainEqual({ type: "property", value: "number" });
	});

	test("paints a decorator as the function it names", () => {
		let tokens = scan("@Injectable()\nclass Service {}", typescript);

		expect(tokens.at(0)).toEqual({ type: "function", value: "@Injectable" });
	});

	test("paints a type argument list as punctuation around its types", () => {
		let tokens = scan("let store: Map<string, Row>;", typescript);

		expect(tokens).toEqual([
			{ type: "keyword", value: "let" },
			{ type: "plain", value: " store" },
			{ type: "operator", value: ":" },
			{ type: "plain", value: " " },
			{ type: "class-name", value: "Map" },
			{ type: "punctuation", value: "<" },
			{ type: "builtin", value: "string" },
			{ type: "punctuation", value: "," },
			{ type: "plain", value: " " },
			{ type: "class-name", value: "Row" },
			{ type: "punctuation", value: ">;" },
		]);
	});

	test("reads a tight comparison as an operator", () => {
		let tokens = scan("if (count<total) return;", typescript);

		expect(tokens).toContainEqual({ type: "operator", value: "<" });
	});

	test("paints a call whose type arguments come between the name and the parenthesis", () => {
		let tokens = scan("let rows = query<Row>(sql);", typescript);

		expect(tokens).toContainEqual({ type: "function", value: "query" });
	});

	test("keeps painting comments, strings and template literals", () => {
		let tokens = scan("// note\nlet q = `id = ${id as number}`;", typescript);

		expect(tokens).toContainEqual({ type: "comment", value: "// note" });
		expect(tokens).toContainEqual({ type: "string", value: "`id = " });
		expect(tokens).toContainEqual({ type: "keyword", value: "as" });
		expect(tokens).toContainEqual({ type: "builtin", value: "number" });
	});

	test("covers a module exactly", () => {
		let code = `import type { ResolvedType } from "@pkg/types";

async function fetchUser(id: string): Promise<{ name: string; email: string }> {
	// ...
}

// Extract the resolved type without calling the function
type User = ResolvedType<typeof fetchUser>; // { name: string; email: string }
`;
		let tokens = scan(code, typescript);

		expect(tokens.map((token) => token.value).join("")).toBe(code);
		expect(tokens).toContainEqual({ type: "keyword", value: "import" });
		expect(tokens).toContainEqual({ type: "function", value: "fetchUser" });
		expect(tokens).toContainEqual({ type: "class-name", value: "ResolvedType" });
		expect(tokens).toContainEqual({ type: "comment", value: "// ..." });
	});
});
