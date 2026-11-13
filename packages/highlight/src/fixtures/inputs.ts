/**
 * Large, deterministic inputs for the benchmarks and the timing tests: a long
 * TypeScript file, a minified line, a big JSON document and a long Markdown
 * file, built from this package's own sources so every run measures the same.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const PACKAGE_ROOT = join(import.meta.dirname, "..", "..");

/**
 * Repeats a text until it reaches a number of lines, then cuts it there, so an
 * input's size is fixed by the caller rather than by how long the sources are.
 */
function repeatToLines(text: string, lines: number): string {
	let source = text.endsWith("\n") ? text : `${text}\n`;
	let copies = Math.ceil(lines / source.split("\n").length) + 1;
	return source.repeat(copies).split("\n").slice(0, lines).join("\n");
}

/**
 * Every TypeScript source of this package, grammars and tests included,
 * concatenated in a stable order.
 */
function packageTypeScript(): string {
	let directory = join(PACKAGE_ROOT, "src");
	return readdirSync(directory, { recursive: true, encoding: "utf8" })
		.filter((path) => path.endsWith(".ts") && !path.includes("fixtures"))
		.sort()
		.map((path) => readFileSync(join(directory, path), "utf8"))
		.join("\n");
}

/** A 10,000-line TypeScript file. */
export function largeTypeScript(): string {
	return repeatToLines(packageTypeScript(), 10_000);
}

/**
 * One line of minified JavaScript, about 500 KB long, the shape a bundler
 * writes: no newlines, short names, every construct packed together.
 */
export function minifiedJavaScript(): string {
	let chunk =
		'function a(b,c){return b.map(function(d){return d*c+"x"}).filter(Boolean)}var e={f:1,g:[2,3.5,0x1f],h:"s\\"t",i:/[a-z]+/g,j:`t${1+2}`};if(e.f>=1&&!e.h){a(e.g,2)}else{e.f=null};';
	return chunk.repeat(Math.ceil(500_000 / chunk.length));
}

/** A pretty-printed JSON document of about 2 MB. */
export function largeJson(): string {
	let items = Array.from({ length: 12_000 }, (_, index) => ({
		id: index,
		name: `item-${index}`,
		active: index % 3 === 0,
		score: index * 1.25,
		tags: ["alpha", "beta", index % 2 === 0 ? "even" : "odd"],
		owner: index % 5 === 0 ? null : { login: `user${index % 97}`, verified: true },
	}));
	return JSON.stringify({ items }, null, 2);
}

/** A 10,000-line Markdown file, this package's README repeated. */
export function longMarkdown(): string {
	return repeatToLines(readFileSync(join(PACKAGE_ROOT, "README.md"), "utf8"), 10_000);
}
