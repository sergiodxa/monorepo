/**
 * Holds the scanner to `oxc-parser`: every JavaScript and TypeScript file in the repository,
 * and every ambiguity fixture, must yield the same module references, comments, strings,
 * regular expressions and template literals from both, at the same ranges.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { iife } from "@sdxc/iife";
import { isFailure } from "@sdxc/result";
import { parseSync } from "oxc-parser";
import { describe, expect, test } from "vitest";

import { findModuleReferences } from "./references.js";
import { analyze } from "./structure.js";

/**
 * One reference as a comparable line: kind, specifier range, declaration range, specifier and
 * bound names with their type-only flags.
 */
function line(
	kind: string,
	specifier: string,
	specifierRange: [number, number],
	range: [number, number],
	names: string[],
): string {
	return `${kind} ${specifierRange[0]}-${specifierRange[1]} ${range[0]}-${range[1]} ${JSON.stringify(specifier)} [${names.join(", ")}]`;
}

/**
 * The references `oxc-parser` reports for `source`, or `null` when it rejects the file, in
 * which case nothing can be compared.
 */
function oracleReferences(filename: string, source: string): string[] | null {
	let parsed = parseSync(filename, source, { lang: langOf(filename) });
	if (parsed.errors.length > 0) return null;
	let lines: string[] = [];
	for (let entry of parsed.module.staticImports) {
		let request = entry.moduleRequest;
		lines.push(
			line(
				"import",
				request.value,
				[request.start, request.end],
				[entry.start, entry.end],
				entry.entries.map((name) => {
					let imported = iife(() => {
						if (name.importName.kind === "Default") return "default";
						if (name.importName.kind === "NamespaceObject") return "*";
						return name.importName.name ?? "";
					});
					return `${name.isType ? "type " : ""}${imported} as ${name.localName.value}`;
				}),
			),
		);
	}
	for (let entry of parsed.module.staticExports) {
		let request = entry.entries.find((name) => name.moduleRequest !== null)?.moduleRequest;
		if (request === undefined || request === null) continue;
		if (!source.startsWith("export", entry.start)) continue;
		let names = entry.entries
			.filter((name) => name.importName.kind !== "AllButDefault")
			.map((name) => {
				let imported = name.importName.kind === "All" ? "*" : (name.importName.name ?? "");
				return `${name.isType ? "type " : ""}${imported} as ${name.exportName.name ?? ""}`;
			});
		lines.push(
			line("export", request.value, [request.start, request.end], [entry.start, entry.end], names),
		);
	}
	for (let entry of parsed.module.dynamicImports) {
		let request = entry.moduleRequest;
		let text = source.slice(request.start, request.end);
		if (!/^["']/.test(text)) continue;
		lines.push(
			line(
				"dynamic",
				JSON.parse(`"${text.slice(1, -1).replaceAll('"', '\\"')}"`) as string,
				[request.start, request.end],
				[entry.start, entry.end],
				[],
			),
		);
	}
	for (let comment of parsed.comments) lines.push(`comment ${comment.start}-${comment.end}`);
	collectLiterals(parsed.program, null, lines);
	return lines.sort();
}

/**
 * Pushes a line for every string, regular expression and template literal under `node`, the
 * tokens a misread `/`, `<` or `}` would swallow or split. JSX attribute strings are markup.
 */
function collectLiterals(node: unknown, parent: string | null, lines: string[]): void {
	if (Array.isArray(node)) {
		for (let child of node) collectLiterals(child, parent, lines);
		return;
	}
	if (typeof node !== "object" || node === null) return;
	let record = node as Record<string, unknown> & { type?: unknown; start?: number; end?: number };
	if (typeof record.type !== "string") return;
	if (record.type === "Literal" && parent !== "JSXAttribute") {
		if (typeof record.value === "string") lines.push(`string ${record.start}-${record.end}`);
		else if (record.regex !== undefined) lines.push(`regex ${record.start}-${record.end}`);
	}
	if (record.type === "TemplateLiteral" || record.type === "TSTemplateLiteralType") {
		lines.push(`template ${record.start}-${record.end}`);
	}
	for (let [key, value] of Object.entries(record)) {
		if (key !== "parent" && typeof value === "object") collectLiterals(value, record.type, lines);
	}
}

/** The references the scanner finds for `source`, in the form {@link oracleReferences} uses. */
function scannedReferences(filename: string, source: string): string[] | Error {
	let references = findModuleReferences(filename, source);
	if (isFailure(references)) return references.error;
	let structure = analyze(filename, source);
	if (isFailure(structure)) return structure.error;
	let tokens: string[] = [];
	for (let token of structure.data.tokens) {
		if (token.type === "comment" && !token.value.startsWith("#!")) {
			tokens.push(`comment ${token.start}-${token.end}`);
		} else if (token.type === "string" || token.type === "regex") {
			tokens.push(`${token.type} ${token.start}-${token.end}`);
		}
	}
	let { code, match } = structure.data;
	for (let [index, token] of code.entries()) {
		if (token.type === "template") tokens.push(`template ${token.start}-${token.end}`);
		if (token.type !== "template-head") continue;
		let end = match[index] ?? -1;
		while (code[end]?.type === "template-middle") end = match[end] ?? -1;
		tokens.push(`template ${token.start}-${code[end]?.end ?? -1}`);
	}
	let found = references.data.map((reference) =>
		line(
			reference.kind,
			reference.specifier,
			[reference.specifierRange.start, reference.specifierRange.end],
			[reference.range.start, reference.range.end],
			reference.names.map(
				(name) => `${name.typeOnly ? "type " : ""}${name.imported} as ${name.local}`,
			),
		),
	);
	return [...found, ...tokens].sort();
}

/**
 * The language `oxc-parser` reads `filename` as, matching the scanner's reading of extensions:
 * every JavaScript extension as JSX.
 */
function langOf(filename: string): "jsx" | "ts" | "tsx" | "dts" {
	if (filename.endsWith(".d.ts") || filename.endsWith(".d.mts") || filename.endsWith(".d.cts"))
		return "dts";
	if (filename.endsWith(".tsx")) return "tsx";
	if (/\.[mc]?ts$/.test(filename)) return "ts";
	return "jsx";
}

/** The repository root, four levels above this file. */
const ROOT = join(import.meta.dirname, "..", "..", "..");

/** The directory of the ambiguity fixtures, one file per ambiguous reading. */
const AMBIGUITY = join(import.meta.dirname, "fixtures", "ambiguity");

/** Every tracked file with an extension the scanner reads, relative to {@link ROOT}. */
function repositoryFiles(): string[] {
	let output = execFileSync(
		"git",
		["ls-files", "-z", "--", "*.js", "*.mjs", "*.cjs", "*.jsx", "*.ts", "*.mts", "*.cts", "*.tsx"],
		{ cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
	);
	return output.split("\0").filter((file) => file !== "" && existsSync(join(ROOT, file)));
}

/**
 * The lines on which the scanner and `oxc-parser` disagree for one file: `- ` for what only
 * `oxc-parser` found, `+ ` for what only the scanner found, or the scanner's failure.
 */
function disagreements(filename: string, source: string): string[] | null {
	let expected = oracleReferences(filename, source);
	if (expected === null) return null;
	let actual = scannedReferences(filename, source);
	if (actual instanceof Error) return [`scanner failed: ${actual.message}`];
	let found = new Set(actual);
	let reported = new Set(expected);
	return [
		...expected.filter((entry) => !found.has(entry)).map((entry) => `- ${entry}`),
		...actual.filter((entry) => !reported.has(entry)).map((entry) => `+ ${entry}`),
	];
}

describe("the scanner agrees with oxc-parser", () => {
	test.each(readdirSync(AMBIGUITY).filter((file) => file.endsWith(".txt")))("%s", (file) => {
		let filename = file.slice(0, -".txt".length);
		let source = readFileSync(join(AMBIGUITY, file), "utf8");

		expect(disagreements(filename, source)).toEqual([]);
	});

	test("on every source file in the repository", () => {
		let differing: Record<string, string[]> = {};
		let compared = 0;
		for (let file of repositoryFiles()) {
			let result = disagreements(file, readFileSync(join(ROOT, file), "utf8"));
			if (result === null) continue;
			compared += 1;
			if (result.length > 0) differing[file] = result;
		}

		expect(compared).toBeGreaterThan(1000);
		expect(differing).toEqual({});
	}, 120_000);
});
