/**
 * Tests for the module extractor: which declarations reach the document, the
 * shape each one arrives in, and the failures a caller has to report.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, isSuccess } from "@sdxc/result";
import { describe, expect, test } from "vitest";

import type { ExtractOptions } from "./extract.js";
import type { DocModule, DocNode } from "./types.js";

import { extract } from "./extract.js";

/** Extract a fixture, failing the test with the syntax error when it will not parse. */
function documented(source: string, options: ExtractOptions = {}): DocModule {
	let result = extract(source, options);
	if (isFailure(result)) throw result.error;
	return result.data;
}

/** Find a documented symbol by name, at the top level or inside a parent. */
function child(parent: DocModule | DocNode, name: string): DocNode | undefined {
	return parent.children.find((candidate) => candidate.name === name);
}

describe("extract", () => {
	test("claims the file header when a blank line separates it from the first declaration", () => {
		let module = documented(`/**
 * The module header.
 *
 * @author Someone
 */

/** The function. */
export function add() {}`);

		expect(module.comment?.description).toBe("The module header.");
		expect(child(module, "add")?.comment?.description).toBe("The function.");
	});

	test("leaves a header attached to the declaration it documents", () => {
		let module = documented(`/**
 * The function.
 */
export function add() {}`);

		expect(module.comment).toBeNull();
		expect(child(module, "add")?.comment?.description).toBe("The function.");
	});

	test("names the module after the path, without its extension", () => {
		let module = documented("export function add() {}", { path: "src/math/add.ts" });

		expect(module.id).toBe("src/math/add");
		expect(child(module, "add")?.id).toBe("src/math/add#add");
		expect(child(module, "add")?.source).toEqual({ path: "src/math/add.ts", line: 1, column: 1 });
	});

	test("prefixes ids with the id the caller chose", () => {
		let module = documented("export function add() {}", { path: "src/add.ts", id: "@scope/pkg" });

		expect(child(module, "add")?.id).toBe("@scope/pkg#add");
	});

	test("reads a function into one signature of parameters and a return type", () => {
		let module = documented(`/**
 * Adds numbers.
 *
 * @param a - The left addend.
 * @param rest - Everything else.
 */
export async function add<T extends number>(a: T, b = 1, ...rest: number[]): Promise<number> {
	return a;
}`);

		let node = child(module, "add");
		expect(node?.kind).toBe("function");
		expect(node?.flags.async).toBe(true);
		expect(node?.signatures[0]?.returns).toBe("Promise<number>");
		expect(node?.signatures[0]?.typeParameters).toEqual([
			{ name: "T", constraint: "number", default: null, description: null },
		]);
		expect(node?.signatures[0]?.parameters).toEqual([
			{
				name: "a",
				type: "T",
				description: "The left addend.",
				optional: false,
				rest: false,
				default: null,
			},
			{ name: "b", type: null, description: null, optional: true, rest: false, default: "1" },
			{
				name: "rest",
				type: "number[]",
				description: "Everything else.",
				optional: false,
				rest: true,
				default: null,
			},
		]);
	});

	test("merges overloads into one symbol that keeps a comment per signature", () => {
		let module = documented(`/** Reads a value. */
export function read(key: string): string;
/** Reads a value with a fallback. */
export function read(key: string, fallback: string): string;
export function read(key: string, fallback?: string): string {
	return fallback ?? key;
}`);

		let node = child(module, "read");
		expect(module.children).toHaveLength(1);
		expect(node?.signatures).toHaveLength(3);
		expect(node?.signatures.map((signature) => signature.comment?.description)).toEqual([
			"Reads a value.",
			"Reads a value with a fallback.",
			undefined,
		]);
	});

	test("documents the members a class exposes and drops the ones it hides", () => {
		let module = documented(`export abstract class Store<T> extends Base<T> implements Readable {
	/** How many entries fit. */
	static readonly limit = 10;
	private secret = "";
	#inner = "";
	protected entries: T[] = [];
	/** Builds a store. */
	constructor(readonly name: string, private key: string) {
		super();
	}
	get size(): number {
		return this.entries.length;
	}
	set size(value: number) {}
	/** Reads one entry. */
	read(index: number): T | undefined {
		return this.entries[index];
	}
}`);

		let node = child(module, "Store");
		expect(node?.kind).toBe("class");
		expect(node?.flags.abstract).toBe(true);
		expect(node?.extends).toEqual(["Base<T>"]);
		expect(node?.implements).toEqual(["Readable"]);
		expect(node?.typeParameters.map((parameter) => parameter.name)).toEqual(["T"]);
		expect(node?.children.map((member) => member.name)).toEqual([
			"constructor",
			"name",
			"limit",
			"entries",
			"size",
			"read",
		]);
		expect(child(node!, "limit")?.flags).toMatchObject({ static: true, readonly: true });
		expect(child(node!, "entries")?.flags.visibility).toBe("protected");
		expect(child(node!, "name")).toMatchObject({ kind: "property", type: "string" });
		expect(child(node!, "size")).toMatchObject({ kind: "accessor", type: "number" });
		expect(child(node!, "read")?.signatures[0]?.returns).toBe("T | undefined");
		expect(child(node!, "constructor")?.comment?.description).toBe("Builds a store.");
	});

	test("reads an interface into its properties and methods", () => {
		let module = documented(`/** A record. */
export interface Entry extends Base {
	/** Stable identifier. */
	readonly id: string;
	label?: string;
	render(width: number): string;
}`);

		let node = child(module, "Entry");
		expect(node?.kind).toBe("interface");
		expect(node?.extends).toEqual(["Base"]);
		expect(child(node!, "id")?.flags.readonly).toBe(true);
		expect(child(node!, "label")?.flags.optional).toBe(true);
		expect(child(node!, "render")).toMatchObject({ kind: "method" });
	});

	test("reads a type alias with the description its template tag supplies", () => {
		let module = documented(`/**
 * A mapping.
 *
 * @template K - What the keys are.
 */
export type Table<K extends string> = Record<K, number>;`);

		let node = child(module, "Table");
		expect(node?.kind).toBe("type-alias");
		expect(node?.type).toBe("Record<K, number>");
		expect(node?.typeParameters).toEqual([
			{ name: "K", constraint: "string", default: null, description: "What the keys are." },
		]);
	});

	test("reads an enum and the value of each member", () => {
		let module = documented(`export enum Level {
	/** Nothing is written. */
	Off = 0,
	Info = "info",
}`);

		let node = child(module, "Level");
		expect(node?.kind).toBe("enum");
		expect(node?.children.map((member) => [member.name, member.type, member.kind])).toEqual([
			["Off", "0", "enum-member"],
			["Info", '"info"', "enum-member"],
		]);
		expect(child(node!, "Off")?.comment?.description).toBe("Nothing is written.");
	});

	test("reads a variable, and an arrow function as the function it is", () => {
		let module = documented(`/** The ceiling. */
export const LIMIT: number = 10;
/** Doubles. */
export let double = (value: number): number => value * 2;`);

		expect(child(module, "LIMIT")).toMatchObject({ kind: "variable", type: "number" });
		expect(child(module, "double")?.kind).toBe("function");
		expect(child(module, "double")?.signatures[0]?.returns).toBe("number");
	});

	test("reads the exports declared inside a namespace", () => {
		let module = documented(`/** Shared shapes. */
export namespace Doc {
	/** An identifier. */
	export type Id = string;
	export interface Node {
		id: Id;
	}
}`);

		let node = child(module, "Doc");
		expect(node?.kind).toBe("namespace");
		expect(node?.children.map((member) => [member.name, member.id])).toEqual([
			["Id", "module#Doc.Id"],
			["Node", "module#Doc.Node"],
		]);
	});

	test("publishes a declaration under the name its export clause gives it", () => {
		let module = documented(`/** Adds. */
function add(a: number) {
	return a;
}

export { add as plus };`);

		expect(module.children.map((node) => node.name)).toEqual(["plus"]);
		expect(child(module, "plus")?.comment?.description).toBe("Adds.");
	});

	test("keeps the source name of a default export and marks it as one", () => {
		let module = documented(`/** Adds. */
export default function add(a: number) {
	return a;
}`);

		expect(child(module, "add")?.flags.default).toBe(true);
	});

	test("documents a default export that is an expression", () => {
		let module = documented(`/** The configured client. */
export default createClient({ retries: 3 });`);

		expect(child(module, "default")).toMatchObject({
			kind: "variable",
			flags: expect.objectContaining({ default: true }),
		});
		expect(child(module, "default")?.comment?.description).toBe("The configured client.");
	});

	test("reports what a barrel forwards instead of guessing at it", () => {
		let module = documented(`export * from "./parse.js";
export * as tags from "./tags.js";
export { extract, ExtractError as Failure } from "./extract.js";
export type { DocNode } from "./types.js";`);

		expect(module.children).toEqual([]);
		expect(module.reExports).toEqual([
			{ kind: "all", module: "./parse.js", name: null, exported: null, typeOnly: false },
			{ kind: "namespace", module: "./tags.js", name: null, exported: "tags", typeOnly: false },
			{
				kind: "named",
				module: "./extract.js",
				name: "extract",
				exported: "extract",
				typeOnly: false,
			},
			{
				kind: "named",
				module: "./extract.js",
				name: "ExtractError",
				exported: "Failure",
				typeOnly: false,
			},
			{ kind: "named", module: "./types.js", name: "DocNode", exported: "DocNode", typeOnly: true },
		]);
	});

	test("documents only what the module exports", () => {
		let module = documented(`/** Internal helper. */
function helper() {}

/** The export. */
export function used() {
	helper();
}`);

		expect(module.children.map((node) => node.name)).toEqual(["used"]);
	});

	test("drops symbols marked internal unless the caller asks for them", () => {
		let source = `/**
 * Not for consumers.
 *
 * @internal
 */
export function unstable() {}

/** For consumers. */
export function stable() {}`;

		expect(documented(source).children.map((node) => node.name)).toEqual(["stable"]);
		expect(documented(source, { includeInternal: true }).children.map((node) => node.name)).toEqual(
			["unstable", "stable"],
		);
	});

	test("marks a deprecated symbol from its tag", () => {
		let module = documented(`/**
 * The old way.
 *
 * @deprecated Use \`read\` instead.
 */
export function load() {}`);

		expect(child(module, "load")?.flags.deprecated).toBe(true);
	});

	test("parses JSX when the path says the file contains it", () => {
		let module = documented(
			`/** Renders a heading. */
export function Title({ text }: { text: string }) {
	return <h1>{text}</h1>;
}`,
			{ path: "src/title.tsx" },
		);

		expect(child(module, "Title")?.kind).toBe("function");
		expect(child(module, "Title")?.signatures[0]?.parameters[0]?.name).toBe("{ text }");
	});

	test("takes parameter and return types from the tags of a JavaScript file", () => {
		let module = documented(
			`/**
 * Adds two numbers.
 *
 * @param {number} a - The left addend.
 * @returns {number} The sum.
 */
export function add(a, b) {
	return a + b;
}`,
			{ path: "src/add.js" },
		);

		let [signature] = child(module, "add")?.signatures ?? [];
		expect(signature?.parameters[0]?.type).toBe("number");
		expect(signature?.returns).toBe("number");
	});

	test("reports a syntax error with the position it was found at", () => {
		let result = extract("export function add(\n", { path: "src/add.ts" });

		expect(isSuccess(result)).toBe(false);
		if (!isFailure(result)) return;
		expect(result.error.path).toBe("src/add.ts");
		expect(result.error.diagnostics[0]).toMatchObject({ line: 2, column: 1 });
		expect(result.error.message).toContain("src/add.ts:2:1");
	});

	test("extracts an empty module without inventing anything", () => {
		expect(documented("")).toEqual({
			id: "module",
			path: "module.ts",
			comment: null,
			children: [],
			reExports: [],
		});
	});
});
