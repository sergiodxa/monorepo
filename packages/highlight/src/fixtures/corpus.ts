/**
 * The inputs the differential tests compare scanners on: every string literal
 * the grammar tests write, a stable sample of real files from the repository,
 * and seeded splices of both that land in states no hand-written test reaches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/** A named input, and the grammar it was written in when that is known. */
export interface Sample {
	name: string;
	code: string;
	language?: string;
}

const SOURCE_ROOT = join(import.meta.dirname, "..");
const REPO_ROOT = join(SOURCE_ROOT, "..", "..", "..");
const MAX_FILE_BYTES = 120_000;
const FILES_PER_KIND = 12;
const SKIPPED_DIRECTORIES = new Set(["node_modules", "dist", "build", ".wrangler", ".git"]);

/** The grammar each sampled extension is scanned with. */
const EXTENSIONS: Record<string, string> = {
	".ts": "typescript",
	".tsx": "tsx",
	".css": "css",
	".json": "json",
	".md": "markdown",
	".yml": "yaml",
	".yaml": "yaml",
	".sh": "bash",
};

/** The directories real files are sampled from, relative to the repository root. */
const SAMPLED_DIRECTORIES = ["packages", ".github", "scripts", "docs"];

/**
 * Every quoted, single-quoted and template literal (without interpolation)
 * written in the package's tests, decoded to the text the test scans.
 */
export function testLiterals(): Sample[] {
	let files = readdirSync(SOURCE_ROOT, { recursive: true, encoding: "utf8" })
		.filter((path) => path.endsWith(".test.ts") && !path.includes("fixtures"))
		.sort();
	let literal = /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\[\s\S]|[^`\\$]|\$(?!\{))*`/g;
	let samples: Sample[] = [];

	for (let file of files) {
		let source = readFileSync(join(SOURCE_ROOT, file), "utf8");
		let language = /grammars\/([\w-]+)\.test\.ts$/.exec(file)?.[1];
		for (let match of source.matchAll(literal)) {
			let code = decode(match[0].slice(1, -1));
			if (code.length > 0) samples.push({ name: `${file}:${match.index}`, code, language });
		}
	}

	return samples;
}

/**
 * Up to {@link FILES_PER_KIND} real files per extension, spread evenly over
 * the sorted list of candidates so the sample is stable from run to run.
 */
export function repositoryFiles(): Sample[] {
	let byExtension = new Map<string, string[]>();

	for (let directory of SAMPLED_DIRECTORIES) {
		for (let path of walk(join(REPO_ROOT, directory))) {
			let extension = Object.keys(EXTENSIONS).find((suffix) => path.endsWith(suffix));
			if (!extension) continue;
			byExtension.set(extension, [...(byExtension.get(extension) ?? []), path]);
		}
	}

	return [...byExtension].flatMap(([extension, paths]) => {
		let sorted = paths.sort();
		let step = Math.max(1, Math.floor(sorted.length / FILES_PER_KIND));
		return sorted
			.filter((_, index) => index % step === 0)
			.slice(0, FILES_PER_KIND)
			.map((path) => ({
				name: relative(REPO_ROOT, path),
				code: readFileSync(path, "utf8"),
				language: EXTENSIONS[extension],
			}));
	});
}

/**
 * Inputs spliced from random slices of the others, with a seeded generator:
 * cutting real code at arbitrary points leaves strings, comments and nested
 * modes open in ways no hand-written test does.
 *
 * @param from - The inputs to cut slices from
 * @param count - How many spliced inputs to make
 */
export function splices(from: Sample[], count: number): Sample[] {
	let random = seeded(0x5eed);
	let pieces = [
		"\n",
		"`",
		'"',
		"'",
		"/*",
		"*/",
		"<",
		">",
		"{",
		"}",
		"${",
		"#",
		"*",
		"_",
		"[",
		"](",
		"\\",
		"-->",
		"<!--",
	];
	let samples: Sample[] = [];

	for (let index = 0; index < count; index++) {
		let parts: string[] = [];
		for (let part = 0; part < 6; part++) {
			let source = from[Math.floor(random() * from.length)]?.code ?? "";
			let start = Math.floor(random() * source.length);
			parts.push(source.slice(start, start + Math.floor(random() * 200)));
			parts.push(pieces[Math.floor(random() * pieces.length)] ?? "");
		}
		samples.push({ name: `splice ${index}`, code: parts.join("") });
	}

	return samples;
}

/**
 * Every file under a directory, pruning dependencies, build output and
 * symbolic links before descending, and skipping oversized files.
 */
function walk(directory: string): string[] {
	if (!existsSync(directory)) return [];
	let files: string[] = [];

	for (let entry of readdirSync(directory, { withFileTypes: true })) {
		let path = join(directory, entry.name);
		if (entry.isDirectory() && !SKIPPED_DIRECTORIES.has(entry.name)) files.push(...walk(path));
		else if (entry.isFile() && statSync(path).size <= MAX_FILE_BYTES) files.push(path);
	}

	return files;
}

/** A literal's body with its escapes resolved to the characters they stand for. */
function decode(body: string): string {
	let simple: Record<string, string> = {
		n: "\n",
		t: "\t",
		r: "\r",
		b: "\b",
		f: "\f",
		v: "\v",
		0: "\0",
	};
	return body.replace(
		/\\(u\{[\da-fA-F]+\}|u[\da-fA-F]{4}|x[\da-fA-F]{2}|\n|[\s\S])/g,
		(_, escape: string) => {
			if (escape.startsWith("u{"))
				return String.fromCodePoint(Number.parseInt(escape.slice(2, -1), 16));
			if (escape.length > 1 && (escape[0] === "u" || escape[0] === "x")) {
				return String.fromCharCode(Number.parseInt(escape.slice(1), 16));
			}
			if (escape === "\n") return "";
			return simple[escape] ?? escape;
		},
	);
}

/** A small deterministic generator (mulberry32), so a failing splice reproduces. */
function seeded(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state + 0x6d2b79f5) | 0;
		let value = Math.imul(state ^ (state >>> 15), 1 | state);
		value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
		return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
	};
}
