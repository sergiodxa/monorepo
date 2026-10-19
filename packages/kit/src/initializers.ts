/**
 * `sdxc initializers`: every module in `app/initializers/`, what it exports and the factories
 * it builds them with, such as `createRouter` from `remix/router`, so where the app's one
 * instance of each thing comes from reads as one table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { isFailure, wrap } from "@sdxc/result";

import { isAppSource, listFiles } from "./doctor/files.js";

/** The folder the layout gives initializers. */
const INITIALIZERS_FOLDER = "app/initializers";

/** An imported name that builds an instance: `createRouter`, `openDatabase`, `defineFlags`… */
const FACTORY = /^(?:create|open|define|connect)[A-Z]\w*$/;

/** One initializer. */
export interface Initializer {
	file: string;
	/** Its exported names, `default` for a default export, in source order. */
	exports: string[];
	/** Each imported factory it calls, with the module it comes from. */
	factories: Array<{ name: string; from: string }>;
}

/**
 * Each named import of `source` from a package, by local name, with the package it comes from.
 * Node's built-in modules and the app's own modules build nothing of the app's, so they are
 * left out.
 */
function namedImports(source: string): Map<string, { imported: string; from: string }> {
	let imports = new Map<string, { imported: string; from: string }>();
	for (let match of source.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
		if (match[0].startsWith("import type") || /^(?:node:|~\/|\.)/.test(match[2] ?? "")) continue;
		for (let part of (match[1] ?? "").split(",")) {
			let [imported = "", local = imported] = part
				.trim()
				.replace(/^type\s+/, "")
				.split(/\s+as\s+/);
			if (imported !== "")
				imports.set(local.trim(), { imported: imported.trim(), from: match[2] ?? "" });
		}
	}
	return imports;
}

/** The names `source` exports, `default` for its default export, in source order. */
export function exportedNames(source: string): string[] {
	let names: Array<[number, string]> = [];
	for (let match of source.matchAll(
		/export\s+(?:async\s+)?(?:const|let|function\*?|class)\s+([A-Za-z_$][\w$]*)/g,
	)) {
		names.push([match.index, match[1] as string]);
	}
	for (let match of source.matchAll(/export\s+default\b/g)) names.push([match.index, "default"]);
	for (let match of source.matchAll(/export\s*\{([^}]*)\}(?!\s*from)/g)) {
		for (let part of (match[1] ?? "").split(",")) {
			let name =
				part
					.trim()
					.split(/\s+as\s+/)
					.at(-1)
					?.trim() ?? "";
			if (name !== "" && !name.startsWith("type ")) names.push([match.index, name]);
		}
	}
	return names.sort((a, b) => a[0] - b[0]).map(([, name]) => name);
}

/** Reads every initializer of the project at `root`, tests left out. */
export async function listInitializers(root: string): Promise<Initializer[]> {
	let initializers: Initializer[] = [];
	for (let file of (await listFiles(root, INITIALIZERS_FOLDER)).filter(isAppSource)) {
		let source = await wrap(() => readFile(join(root, file), "utf8"));
		if (isFailure(source)) continue;
		let factories = [...namedImports(source.data)]
			.filter(
				([local, { imported }]) =>
					FACTORY.test(imported) && new RegExp(`\\b${local}\\s*\\(`).test(source.data),
			)
			.map(([, { imported, from }]) => ({ name: imported, from }));
		initializers.push({ file, exports: exportedNames(source.data), factories });
	}
	return initializers;
}

/** The initializers as a table: file, exports, and the factories that build them. */
export function formatInitializers(initializers: readonly Initializer[]): string {
	if (initializers.length === 0) return `No initializers in ${INITIALIZERS_FOLDER}/.\n`;
	let rows = initializers.map((initializer) => [
		initializer.file,
		initializer.exports.join(", "),
		initializer.factories.map((factory) => `${factory.name} (${factory.from})`).join(", "),
	]);
	let header = ["File", "Exports", "Built with"];
	let widths = header.map((title, column) =>
		Math.max(title.length, ...rows.map((row) => row[column]?.length ?? 0)),
	);
	let line = (row: readonly string[]) =>
		row
			.map((cell, column) => cell.padEnd(widths[column] ?? 0))
			.join("  ")
			.trimEnd();
	return `${[line(header), ...rows.map(line)].join("\n")}\n`;
}
