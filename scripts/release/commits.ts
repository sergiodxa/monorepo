/**
 * Conventional-commit records from `git log`, and their attribution to the packages whose
 * shipped inputs they touch. Touched paths are the ground truth for attribution: a scope can
 * be missing or wrong, while the paths a commit changes are exactly what a consumer receives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { Package } from "./workspace.js";

/** `%x1e`, the byte the release's `git log` format starts every record with. */
const RECORD_SEPARATOR = String.fromCharCode(0x1e);

/** `%x1f`, the byte between a record's sha, subject, body and file list. */
const FIELD_SEPARATOR = String.fromCharCode(0x1f);

/** `type(scope)!: title`, the Conventional Commits subject shape. */
const CONVENTIONAL_SUBJECT =
	/^(?<type>[A-Za-z][\w-]*)(?:\((?<scope>[^()]*)\))?(?<breaking>!)?:\s+(?<title>.+)$/;

/** A summary whose first letter is lowercase, the style older commits were written in. */
const LOWERCASE_SUMMARY = /^\p{Ll}/u;

/** A git trailer line, `Token: value`; a final paragraph made only of these is metadata, not prose. */
const TRAILER_LINE = /^[A-Za-z0-9-]+:(?:\s|$)/;

/** A trailer value continued on the next line, which git allows when it starts with whitespace. */
const TRAILER_CONTINUATION = /^\s+\S/;

/** Test files under `src/`, which ship to nobody and so never make a commit a release. */
const TEST_FILE = /\.(?:workers\.)?test\.tsx?$/;

/** The root TypeScript config every package extends, so changing it changes every build. */
const ROOT_TSCONFIG = "tsconfig.json";

/** The trailer naming the commit whose published note this commit's body replaces. */
const CORRECTION_TRAILER = /^Release-Note-For:\s*(?<sha>[0-9a-f]{7,40})\s*$/im;

/** The body `git revert` writes, which names no effect on a consumer. */
const REVERT_BODY = /^This reverts commit [0-9a-f]{7,40}\.$/;

/** The line git writes above its editor instructions under `commit.cleanup=scissors`. */
const SCISSORS_LINE = /^# -{24} >8 -{24}$/m;

export interface Commit {
	sha: string;
	type: string;
	scope: string | null;
	breaking: boolean;
	title: string;
	body: string;
	files: string[];
	/** The sha a `Release-Note-For` trailer names; the body is that commit's replacement note. */
	corrects: string | null;
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
		let rawBody = record.slice(second + 1, last);
		commits.push({
			sha: record.slice(0, first).trim(),
			...parseSubject(record.slice(first + 1, second)),
			body: stripTrailers(rawBody),
			files: record
				.slice(last + 1)
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line !== ""),
			corrects: correctedSha(rawBody),
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

/**
 * A subject split into its Conventional parts; a subject without the `type(scope)!: title`
 * shape is a `chore` titled with the whole subject, and the title keeps the case it was written in.
 */
export function parseSubject(
	subject: string,
): Pick<Commit, "type" | "scope" | "breaking" | "title"> {
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

/**
 * The title as release notes print it, without the `type(scope):` prefix: its first letter is
 * uppercased, so an older lowercase title reads like a capitalized one.
 *
 * @example releaseSummary("add ES512 signing keys") // "Add ES512 signing keys"
 */
export function releaseSummary(title: string): string {
	let first = title.codePointAt(0);
	if (first === undefined) return title;
	let char = String.fromCodePoint(first);
	return `${char.toUpperCase()}${title.slice(char.length)}`;
}

/**
 * Whether a Conventional subject's summary starts with a lowercase letter, which a new commit may
 * not have; a summary opening with code, a digit or punctuation passes, as does any other subject.
 */
export function hasLowercaseSummary(subject: string): boolean {
	let trimmed = subject.trim();
	if (!CONVENTIONAL_SUBJECT.test(trimmed)) return false;
	return isLowercaseSummary(parseSubject(trimmed).title);
}

/** Whether a title, the summary after `type(scope):`, starts with a lowercase letter. */
export function isLowercaseSummary(title: string): boolean {
	return LOWERCASE_SUMMARY.test(title);
}

/** The subject line of a commit message: its first line that is neither blank nor a `#` comment. */
export function messageSubject(message: string): string {
	return message.split("\n").find((line) => line.trim() !== "" && !line.startsWith("#")) ?? "";
}

/**
 * The release note a commit message publishes: the text after the subject line, cut at git's
 * scissors line and without its trailers. The `commit-msg` hook reads a message before git
 * cleans it up, so the scissors cut is what keeps the editor instructions out of the body.
 */
export function messageBody(message: string): string {
	let scissors = SCISSORS_LINE.exec(message);
	let kept = scissors === null ? message : message.slice(0, scissors.index);
	let newline = kept.indexOf("\n");
	return newline === -1 ? "" : stripTrailers(kept.slice(newline + 1));
}

/**
 * Whether a trailer-free body leaves the release note missing: empty, or exactly the line
 * `git revert` writes, since neither tells a consumer what changed for them.
 */
export function isMissingBody(body: string): boolean {
	let trimmed = body.trim();
	return trimmed === "" || REVERT_BODY.test(trimmed);
}

/**
 * Corrections attributed to the packages of the commit they correct: each commit with a
 * `Release-Note-For` trailer gains the files `filesOf` reports for the named sha, so an empty
 * correction publishes under the same packages as the note it replaces.
 */
export async function attributeCorrections(
	commits: Commit[],
	filesOf: (sha: string) => Promise<Result<string[], Error>>,
): Promise<Result<Commit[], Error>> {
	let attributed: Commit[] = [];
	for (let commit of commits) {
		if (commit.corrects === null) {
			attributed.push(commit);
			continue;
		}
		let files = await filesOf(commit.corrects);
		if (isFailure(files)) return files;
		attributed.push({ ...commit, files: [...new Set([...commit.files, ...files.data])] });
	}
	return success(attributed);
}

function correctedSha(body: string): string | null {
	return CORRECTION_TRAILER.exec(body)?.groups?.sha ?? null;
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
