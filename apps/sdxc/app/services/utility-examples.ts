/**
 * The live examples of the `@sdxc/u` catalogue, read as source: each one's title, the
 * sentence introducing it, and the code a reader copies. The code is cut from the module's
 * own `render`, so what the page prints is what drew the frame beside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

const sources = import.meta.glob<string>("../../resources/components/utility-examples/*/*.tsx", {
	query: "?raw",
	import: "default",
});

/** One example as its utility's page lists it. */
export interface UtilityExampleSource {
	/** The example's segment in its frame's URL: the file name without its ordering prefix. */
	slug: string;
	title: string;
	/** The sentence introducing the example, with code written in backticks. */
	description: string;
	/** The markup that draws the example, with its decoration shown as `...`. */
	code: string;
}

/** Where an example file sits: its utility's folder and its own name. */
interface ExamplePath {
	utility: string;
	file: string;
}

/** The parts of an example's path, or `null` for a path outside the examples folder. */
function parsePath(path: string): ExamplePath | null {
	let [, utility, file] = /\/utility-examples\/([^/]+)\/([^/]+)\.tsx$/.exec(path) ?? [];
	if (!utility || !file) return null;
	return { utility, file };
}

/** The slug a file answers to: its name, without the digits that order it among its siblings. */
export function slugOf(file: string): string {
	return file.replace(/^\d+-/, "");
}

/** Every utility with at least one example, which is what the coverage test walks. */
export function utilitiesWithExamples(): string[] {
	let names = new Set<string>();
	for (let path of Object.keys(sources)) {
		let parsed = parsePath(path);
		if (parsed) names.add(parsed.utility);
	}
	return [...names].sort();
}

/**
 * A utility's examples, in the order of their file names. Only that utility's files are
 * loaded, so a page reads its own handful of sources rather than the whole catalogue's.
 */
export async function listUtilityExamples(utility: string): Promise<UtilityExampleSource[]> {
	let entries = Object.entries(sources)
		.map(([path, load]) => ({ parsed: parsePath(path), load }))
		.filter((entry) => entry.parsed?.utility === utility)
		.sort((a, b) => (a.parsed?.file ?? "").localeCompare(b.parsed?.file ?? ""));

	return await Promise.all(
		entries.map(async ({ parsed, load }) => ({
			slug: slugOf(parsed?.file ?? ""),
			...readExampleSource(await load()),
		})),
	);
}

/**
 * Reads an example module's title, description and code from its text.
 *
 * The title and description are the double-quoted strings the module assigns them. The
 * code is a `code` template literal when the module writes one, which is how an example
 * drawn by an island shows the markup a reader would write, and otherwise the expression
 * its `render` arrow returns, dedented, with each `demo.*` call printed as `...`.
 *
 * @param source - The example module's text.
 * @returns What the page prints for the example; a missing field reads as empty.
 */
export function readExampleSource(source: string): Omit<UtilityExampleSource, "slug"> {
	return {
		title: readString(source, "title"),
		description: readString(source, "description"),
		code: elideDemo(readCodeLiteral(source) ?? dedent(readRenderBody(source))),
	};
}

/**
 * The string literal a property is assigned, decoded the way JavaScript reads it. Either
 * quote is read, because the formatter switches a string holding `"` to single quotes.
 */
function readString(source: string, property: string): string {
	let match = new RegExp(`\\b${property}:\\s*(["'])((?:(?!\\1)[^\\\\]|\\\\.)*)\\1`).exec(source);
	if (!match) return "";
	let body =
		match[1] === "'" ? match[2]?.replace(/\\'/g, "'").replace(/(?<!\\)"/g, '\\"') : match[2];
	return JSON.parse(`"${body ?? ""}"`) as string;
}

/** The `code` template literal, unescaped, or `null` when the module writes none. */
function readCodeLiteral(source: string): string | null {
	let match = /\bcode:\s*`((?:[^`\\]|\\.)*)`/.exec(source);
	if (!match) return null;
	return match[1]?.replace(/\\([`\\$])/g, "$1") ?? "";
}

/**
 * The expression `render` returns: the parenthesised JSX a formatted module wraps a
 * multi-line element in, or the rest of the line for one that fits on it.
 */
function readRenderBody(source: string): string {
	let arrow = /\brender:\s*\([^)]*\)\s*=>\s*/.exec(source);
	if (!arrow) return "";

	let start = arrow.index + arrow[0].length;
	if (source[start] !== "(") {
		let end = source.indexOf("\n", start);
		return source.slice(start, end === -1 ? undefined : end).replace(/,\s*$/, "");
	}

	let close = matchingParen(source, start);
	return source.slice(start + 1, close);
}

/** The index of the parenthesis closing the one at `open`, counting every pair between. */
function matchingParen(source: string, open: number): number {
	let depth = 0;
	for (let index = open; index < source.length; index++) {
		let char = source[index];
		if (char === "(") depth++;
		if (char === ")" && --depth === 0) return index;
	}
	return source.length;
}

/** Strips the indentation every line shares, and the blank lines around the block. */
function dedent(block: string): string {
	let lines = block
		.replace(/^\s*\n/, "")
		.replace(/\s+$/, "")
		.split("\n");
	let indents = lines
		.filter((line) => line.trim() !== "")
		.map((line) => /^\s*/.exec(line)?.[0].length ?? 0);
	let shared = indents.length > 0 ? Math.min(...indents) : 0;
	return lines.map((line) => line.slice(shared)).join("\n");
}

/**
 * Prints each `demo.*` call as `...`, collapsing a run of them in one list into a single
 * `...`, so a `mix` list reads as the utility it teaches and a mark that more is there.
 */
export function elideDemo(code: string): string {
	let out = "";
	let index = 0;

	while (index < code.length) {
		let match = /\bdemo\.\w+\(/.exec(code.slice(index));
		if (!match) {
			out += code.slice(index);
			break;
		}

		let start = index + match.index;
		let close = matchingParen(code, start + match[0].length - 1);
		out += `${code.slice(index, start)}...`;
		index = close + 1;
	}

	return out.replace(/\.\.\.(?:,\s*\.\.\.)+/g, "...");
}
