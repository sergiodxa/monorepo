/**
 * Suite loading: discovers every `.spec` file under a root directory, parses
 * them in lexicographic relative-path order, then registers suite-global
 * definitions in a second pass — so name resolution never depends on file
 * order and duplicates surface before any test runs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Result } from "@pkg/result";

import { failure, isFailure, success } from "@pkg/result";

import type { CommandNode, FixtureNode, SpecFileNode } from "./ast";
import type { SpecError } from "./errors";

import { LoadError, ParseError } from "./errors";
import { parse } from "./parser";

/** A fully loaded suite: every parsed file plus its global definition maps. */
export interface LoadedSuite {
	/** Every parsed `.spec` file, in lexicographic relative-path order. */
	files: SpecFileNode[];
	/** Suite-global commands by name, registered across every file. */
	commands: Map<string, CommandNode>;
	/** Suite-global fixtures by name, registered across every file. */
	fixtures: Map<string, FixtureNode>;
}

/**
 * Load a suite from a directory: find `*.spec` files recursively, parse each
 * one (the first parse failure aborts the load, its message prefixed with the
 * file's path), then register every definition suite-globally. Two
 * definitions sharing a name — regardless of kind — are a
 * `duplicate-definition` load error naming both files.
 *
 * @param root - The suite directory, conventionally `spec/`.
 * @returns The loaded suite, or the load/parse error that prevented it.
 */
export async function loadSuite(root: string): Promise<Result<LoadedSuite, SpecError>> {
	let relativePaths: string[];
	try {
		relativePaths = await collectSpecFiles(root, "");
	} catch (cause) {
		return failure(
			new LoadError(
				"load-error",
				`Could not read the suite directory ${root}: ${describeCause(cause)}`,
			),
		);
	}
	if (relativePaths.length === 0) {
		return failure(new LoadError("load-error", `No .spec files found under ${root}.`));
	}
	relativePaths.sort();

	let files: SpecFileNode[] = [];
	for (let relativePath of relativePaths) {
		let path = join(root, relativePath);
		let text: string;
		try {
			text = await readFile(path, "utf8");
		} catch (cause) {
			return failure(
				new LoadError("load-error", `Could not read ${path}: ${describeCause(cause)}`),
			);
		}
		let parsed: Result<SpecFileNode, ParseError> = parse({ path, text });
		if (isFailure(parsed)) {
			return failure(
				new ParseError(
					`${path}: ${parsed.error.message}`,
					parsed.error.file ?? path,
					parsed.error.span,
				),
			);
		}
		files.push(parsed.data);
	}

	let commands = new Map<string, CommandNode>();
	let fixtures = new Map<string, FixtureNode>();
	let origins = new Map<string, { kind: "command" | "fixture"; file: string }>();
	for (let file of files) {
		for (let definition of file.definitions) {
			let previous = origins.get(definition.name);
			if (previous) {
				return failure(
					new LoadError(
						"duplicate-definition",
						`Duplicate definition "${definition.name}": ${previous.kind} in ${previous.file} and ${definition.kind} in ${file.path}.`,
					),
				);
			}
			origins.set(definition.name, { kind: definition.kind, file: file.path });
			if (definition.kind === "command") commands.set(definition.name, definition);
			else fixtures.set(definition.name, definition);
		}
	}

	return success({ files, commands, fixtures });
}

/**
 * Walk a directory tree collecting `.spec` file paths relative to the root.
 * Directories reached through symlinks are skipped, which keeps the walk
 * cycle-free. Filesystem failures propagate for the caller to wrap.
 *
 * @param root - The suite root the walk started from.
 * @param prefix - The directory currently being read, relative to the root.
 * @returns Relative paths of every `.spec` file found under the prefix.
 */
async function collectSpecFiles(root: string, prefix: string): Promise<string[]> {
	let entries = await readdir(join(root, prefix), { withFileTypes: true });
	let found: string[] = [];
	for (let entry of entries) {
		let relativePath = prefix === "" ? entry.name : join(prefix, entry.name);
		if (entry.isDirectory()) {
			found.push(...(await collectSpecFiles(root, relativePath)));
		} else if (entry.isFile() && entry.name.endsWith(".spec")) {
			found.push(relativePath);
		}
	}
	return found;
}

/**
 * Render an unknown thrown value (from `node:fs`) as a one-line reason for a
 * load error message.
 *
 * @param cause - Whatever the filesystem call threw.
 * @returns The cause's message, or its string form for non-Error throws.
 */
function describeCause(cause: unknown): string {
	if (cause instanceof Error) return cause.message;
	return String(cause);
}
