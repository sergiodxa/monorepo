/**
 * Scanner for relative module specifiers that lack a file extension inside package sources.
 * Published packages are emitted by `tsc` with their specifiers untouched, and Node's ESM
 * loader resolves `./parse.js` while refusing `./parse`, so every relative specifier in
 * the `src` folder of every package carries the `.js` extension TypeScript maps back to the `.ts` source.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CodemodError } from "@sdxc/codemod";
import type { Result } from "@sdxc/result";

import { findModuleReferences } from "@sdxc/codemod";
import { isFailure, success } from "@sdxc/result";

/** A relative specifier found without an extension, located for the failure message. */
export interface ExtensionlessSpecifier {
	line: number;
	specifier: string;
}

/**
 * Vitest's module-id functions, whose first argument has to match the specifier form the
 * module under test uses.
 */
const VITEST_CALLS = [
	"vi.mock",
	"vi.doMock",
	"vi.unmock",
	"vi.doUnmock",
	"vi.importActual",
	"vi.importMock",
];

/**
 * Relative specifiers in `source` whose final path segment has no extension: static imports
 * and re-exports, side-effect imports, dynamic `import()` and Vitest's module-id arguments. A
 * `?raw` style query is ignored when judging the extension; comments, strings and JSX text are
 * never read as imports. A file that cannot be scanned is the failure.
 */
export function findExtensionlessSpecifiers(
	filename: string,
	source: string,
): Result<ExtensionlessSpecifier[], CodemodError> {
	let references = findModuleReferences(filename, source, { calls: VITEST_CALLS });
	if (isFailure(references)) return references;
	let found: ExtensionlessSpecifier[] = [];
	for (let reference of references.data) {
		if (!isRelative(reference.specifier) || hasExtension(reference.specifier)) continue;
		let line = source.slice(0, reference.specifierRange.start).split("\n").length;
		found.push({ line, specifier: reference.specifier });
	}
	return success(found);
}

/** Whether a specifier points at a sibling file rather than a package. */
export function isRelative(specifier: string): boolean {
	return (
		specifier.startsWith("./") ||
		specifier.startsWith("../") ||
		specifier === "." ||
		specifier === ".."
	);
}

/** Whether the specifier's last path segment names a file extension, ignoring any query. */
export function hasExtension(specifier: string): boolean {
	let path = specifier.split("?")[0] ?? "";
	let segment = path.slice(path.lastIndexOf("/") + 1);
	return segment !== "" && segment !== "." && segment !== ".." && segment.includes(".");
}
