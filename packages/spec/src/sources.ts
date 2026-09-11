/**
 * Suite loading from sources already in memory: parse each one, then register
 * suite-global definitions in a second pass — so name resolution never depends
 * on source order and duplicates surface before any test runs.
 *
 * This is the whole of loading that does not involve a filesystem, which is why
 * it lives apart from `loader.ts`: a host that already holds its spec text
 * (from a database row, an HTTP body, a bundled string) needs this and not the
 * directory walk, and a runtime with no filesystem can reach nothing else.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { CommandNode, HookNode, SpecFileNode } from "./ast.js";
import type { SpecError } from "./errors.js";

import { LoadError, ParseError } from "./errors.js";
import { parse } from "./parser.js";

/** One `.spec` file's text, plus the path errors from it are attributed to. */
export interface SpecSource {
	/**
	 * How this source is named in diagnostics. Never opened, so it need not exist
	 * on any disk — but it is what a failure reports and what `positionAt` is
	 * given, so prefer something a reader can locate.
	 */
	path: string;
	/** The source text, verbatim. */
	text: string;
}

/** A fully loaded suite: every parsed file plus its global definition maps. */
export interface LoadedSuite {
	/** Every parsed `.spec` file, in the order its sources were given. */
	files: SpecFileNode[];
	/** Suite-global commands by name, registered across every file. */
	commands: Map<string, CommandNode>;
	/**
	 * The suite's `setup` hook, when one file declares it. It runs once before
	 * any test, regardless of concurrency, and its failure ends the run.
	 */
	setup?: { hook: HookNode; file: SpecFileNode };
	/**
	 * The suite's `teardown` hook, when one file declares it. It runs once
	 * after every test, failures included, which is where a suite removes the
	 * rows it left behind.
	 */
	teardown?: { hook: HookNode; file: SpecFileNode };
}

/**
 * Load a suite from sources: parse each one, then register every definition
 * suite-globally, failing on the first parse error or on any duplicate name
 * across files. Sources are parsed and reported in the caller's order.
 *
 * @param sources - Every `.spec` source in the suite, in the intended order.
 * @returns The loaded suite, or the load/parse error that prevented it.
 */
export function loadSources(sources: readonly SpecSource[]): Result<LoadedSuite, SpecError> {
	if (sources.length === 0) {
		return failure(new LoadError("load-error", "No .spec sources were given to load."));
	}

	let files: SpecFileNode[] = [];
	for (let source of sources) {
		let parsed: Result<SpecFileNode, ParseError> = parse(source);
		if (isFailure(parsed)) {
			return failure(
				new ParseError(
					`${source.path}: ${parsed.error.message}`,
					parsed.error.file ?? source.path,
					parsed.error.span,
				),
			);
		}
		files.push(parsed.data);
	}

	let commands = new Map<string, CommandNode>();
	let origins = new Map<string, string>();
	let suite: LoadedSuite = { files, commands };
	for (let file of files) {
		for (let definition of file.definitions) {
			let previous = origins.get(definition.name);
			if (previous) {
				return failure(
					new LoadError(
						"duplicate-definition",
						`Duplicate definition "${definition.name}": ${definition.kind} in ${previous} and ${definition.kind} in ${file.path}.`,
					),
				);
			}
			origins.set(definition.name, file.path);
			commands.set(definition.name, definition);
		}
		for (let kind of ["setup", "teardown"] as const) {
			let hook = file[kind];
			if (hook === undefined) continue;
			let previous = suite[kind];
			if (previous) {
				return failure(
					new LoadError(
						"duplicate-definition",
						`Duplicate "${kind}" hook: declared in ${previous.file.path} and in ${file.path}. A suite has at most one of each.`,
					),
				);
			}
			suite[kind] = { hook, file };
		}
	}

	return success(suite);
}
