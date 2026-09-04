/**
 * Conventional-commit records from `git log`, and their attribution to the packages whose
 * shipped inputs they touch. Touched paths are the ground truth for attribution: a scope can
 * be missing or wrong, while the paths a commit changes are exactly what a consumer receives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { Package } from "./workspace.js";

/** `%x1e`, the byte the release's `git log` format starts every record with. */
const RECORD_SEPARATOR = String.fromCharCode(0x1e);

/** `%x1f`, the byte between a record's sha, subject, body and file list. */
const FIELD_SEPARATOR = String.fromCharCode(0x1f);

/** `type(scope)!: title`, the Conventional Commits subject shape. */
const CONVENTIONAL_SUBJECT =
	/^(?<type>[A-Za-z][\w-]*)(?:\((?<scope>[^()]*)\))?(?<breaking>!)?:\s+(?<title>.+)$/;

/** A git trailer line, `Token: value`; a final paragraph made only of these is metadata, not prose. */
const TRAILER_LINE = /^[A-Za-z0-9-]+:(?:\s|$)/;

/** A trailer value continued on the next line, which git allows when it starts with whitespace. */
const TRAILER_CONTINUATION = /^\s+\S/;

/** Test files under `src/`, which ship to nobody and so never make a commit a release. */
const TEST_FILE = /\.(?:workers\.)?test\.tsx?$/;

/** The root TypeScript config every package extends, so changing it changes every build. */
const ROOT_TSCONFIG = "tsconfig.json";

export interface Commit {
	sha: string;
	type: string;
	scope: string | null;
	breaking: boolean;
	title: string;
	body: string;
	files: string[];
}

/**
 * Commits from `git log <range> --format=%x1e%H%x1f%s%x1f%b%x1f --name-only`, in the order
 * given; a record short of its four fields is a failure. A subject without the `type(scope)!:
 * title` shape becomes a `chore` titled with the whole subject; a body loses its git trailers.
 */
export function parseCommits(log: string): Result<Commit[], Error> {
	let commits: Commit[] = [];
	for (let record of log.split(RECORD_SEPARATOR)) {
		if (record.trim() === "") continue;
		let first = record.indexOf(FIELD_SEPARATOR);
		let second = record.indexOf(FIELD_SEPARATOR, first + 1);
		let last = record.lastIndexOf(FIELD_SEPARATOR);
		if (first === -1 || second === -1 || last <= second) {
			return failure(new Error(`Malformed git log record: ${record.slice(0, 80)}`));
		}
		commits.push({
			sha: record.slice(0, first).trim(),
			...parseSubject(record.slice(first + 1, second)),
			body: stripTrailers(record.slice(second + 1, last)),
			files: record
				.slice(last + 1)
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line !== ""),
		});
	}
	return success(commits);
}

/**
 * Commits grouped by the package they touch, keeping the given order; a commit touching
 * several packages appears under each, and a package nothing touched has no entry.
 */
export function attributeCommits(commits: Commit[], packages: Package[]): Map<string, Commit[]> {
	let byPackage = new Map<string, Commit[]>();
	for (let commit of commits) {
		for (let name of touchedPackages(commit.files, packages)) {
			byPackage.set(name, [...(byPackage.get(name) ?? []), commit]);
		}
	}
	return byPackage;
}

/**
 * The packages whose shipped inputs `files` fall into, test files ignored. The root
 * `tsconfig.json` counts for every public package because each build extends it.
 */
export function touchedPackages(files: string[], packages: Package[]): Set<string> {
	let touched = new Set<string>();
	let shipped = files.filter((file) => !TEST_FILE.test(file));
	if (shipped.includes(ROOT_TSCONFIG)) {
		for (let pkg of packages) {
			if (!pkg.isPrivate) touched.add(pkg.name);
		}
	}
	for (let pkg of packages) {
		let touches = shipped.some((file) =>
			pkg.shippedPaths.some((path) => file === path || file.startsWith(`${path}/`)),
		);
		if (touches) touched.add(pkg.name);
	}
	return touched;
}

function parseSubject(subject: string): Pick<Commit, "type" | "scope" | "breaking" | "title"> {
	let trimmed = subject.trim();
	let groups = CONVENTIONAL_SUBJECT.exec(trimmed)?.groups;
	if (groups === undefined) return { type: "chore", scope: null, breaking: false, title: trimmed };
	return {
		type: groups.type ?? "chore",
		scope: groups.scope ?? null,
		breaking: groups.breaking === "!",
		title: (groups.title ?? "").trim(),
	};
}

/** The body without its final paragraph when that paragraph is made only of trailer lines. */
function stripTrailers(body: string): string {
	let paragraphs = body.trim().split(/\n[ \t]*\n/);
	let last = paragraphs.at(-1);
	let isTrailers =
		last !== undefined &&
		last.split("\n").every((line) => TRAILER_LINE.test(line) || TRAILER_CONTINUATION.test(line));
	if (isTrailers) paragraphs.pop();
	return paragraphs.join("\n\n").trim();
}
