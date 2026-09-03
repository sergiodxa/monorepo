/**
 * Scanner for relative module specifiers that lack a file extension inside package sources.
 * Published packages are emitted by `tsc` with their specifiers untouched, and Node's ESM
 * loader resolves `./parse.js` while refusing `./parse`, so every relative specifier in
 * `packages/*​/src` carries the `.js` extension TypeScript maps back to the `.ts` source.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A relative specifier found without an extension, located for the failure message. */
export interface ExtensionlessSpecifier {
	line: number;
	specifier: string;
}

/**
 * Every syntactic position a module specifier appears in: static imports and re-exports,
 * side-effect imports, dynamic `import()`, and Vitest's module-id arguments, whose ids
 * have to match the specifier form the module under test uses.
 */
const SPECIFIER_PATTERNS = [
	/\bfrom\s+["']([^"']+)["']/g,
	/^\s*import\s+["']([^"']+)["']/gm,
	/\bimport\s*\(\s*["']([^"']+)["']/g,
	/\bvi\.(?:mock|doMock|unmock|doUnmock|importActual|importMock)\s*\(\s*["']([^"']+)["']/g,
];

/** Lines that are comment prose, where an `@example` may quote a specifier without importing it. */
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/;

/**
 * Relative specifiers in `source` whose final path segment has no extension. A `?raw`
 * style query is ignored when judging the extension, and comment lines are skipped so a
 * JSDoc example never counts as an import.
 */
export function findExtensionlessSpecifiers(source: string): ExtensionlessSpecifier[] {
	let found: ExtensionlessSpecifier[] = [];
	let lines = source.split("\n");

	for (let [index, line] of lines.entries()) {
		if (COMMENT_LINE.test(line)) continue;
		for (let specifier of specifiersIn(line)) {
			if (isRelative(specifier) && !hasExtension(specifier)) {
				found.push({ line: index + 1, specifier });
			}
		}
	}

	return found;
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

/** Every specifier string on one line, in source order. */
function specifiersIn(line: string): string[] {
	let specifiers: string[] = [];
	for (let pattern of SPECIFIER_PATTERNS) {
		for (let match of line.matchAll(pattern)) {
			let specifier = match[1];
			if (specifier !== undefined) specifiers.push(specifier);
		}
	}
	return specifiers;
}
