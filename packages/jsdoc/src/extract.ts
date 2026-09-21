/**
 * Reads one file's source text into its documentation module. Nothing outside
 * the string is consulted — no file system, no imports followed, no type
 * checker — so the same text always yields the same document.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { isFailure, success } from "@sdxc/result";

import type { ExtractError } from "./extract-error.js";
import type { DocModule, DocNode } from "./types.js";

import { collect } from "./declarations.js";
import { moduleComment } from "./jsdoc-text.js";
import { parseSource } from "./syntax.js";

/** How one file is read and what its symbols are named. */
export interface ExtractOptions {
	/**
	 * Path the text came from. Its extension selects the dialect — `.tsx` and
	 * `.jsx` enable JSX syntax — and it is recorded on every node's `source`.
	 *
	 * @default "module.ts"
	 */
	path?: string;

	/**
	 * Identifier every node id is prefixed with, as `<id>#<name>`.
	 *
	 * @default the path with its extension removed
	 */
	id?: string;

	/**
	 * Keep symbols marked `@internal`, which are dropped by default so a
	 * published site shows only what its readers can use.
	 *
	 * @default false
	 */
	includeInternal?: boolean;
}

/**
 * Extract the documentation of a single JavaScript or TypeScript module.
 *
 * Only exported symbols are documented, and a barrel's `export … from` lines
 * arrive as `reExports` for the caller to resolve against the modules it holds.
 *
 * @param source - Contents of one file.
 * @param options - Path, id and whether `@internal` symbols survive.
 * @returns The module, or an `ExtractError` naming each syntax error.
 *
 * @example
 * let result = extract("/** Adds. *\/\nexport function add(a: number) {}", { path: "src/add.ts" });
 */
export function extract(
	source: string,
	options: ExtractOptions = {},
): Result<DocModule, ExtractError> {
	let path = options.path ?? "module.ts";
	let id = options.id ?? path.replace(/\.[^./\\]+$/, "");

	let parsed = parseSource(source, path);
	if (isFailure(parsed)) return parsed;

	let file = parsed.data;
	let header = moduleComment(file);
	let { nodes, reExports } = collect({ path, after: header.end }, file.statements, `${id}#`);

	return success({
		id,
		path,
		comment: header.comment,
		children: options.includeInternal ? nodes : withoutInternal(nodes),
		reExports,
	});
}

/** Drop every `@internal` symbol, at any depth, so nothing under one survives either. */
function withoutInternal(nodes: DocNode[]): DocNode[] {
	return nodes
		.filter((node) => !node.flags.internal)
		.map((node) => ({ ...node, children: withoutInternal(node.children) }));
}
