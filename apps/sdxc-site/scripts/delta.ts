/**
 * The pure half of Delta's extractor: reading what `git log`, `git show` and `git blame` print
 * into the documents `app/services/delta/source.ts` serves, with emails dropped, paths made
 * relative to Delta's folder and oversized patches cut, so each step is testable without git.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {
	DeltaAnchor,
	DeltaAnchorSeed,
	DeltaBlameRange,
	DeltaChangedFile,
	DeltaCommitMeta,
	DeltaPatch,
} from "~/app/services/delta/source";

/** Separates one commit's record from the next in {@link LOG_FORMAT}'s output. */
const RECORD = "\x1e";

/** Separates one field from the next inside a record. */
const FIELD = "\x1f";

/**
 * The `git log --format` every history read uses: sha, parents, author name, ISO author date,
 * subject and body. The author's email is never asked for.
 */
export const LOG_FORMAT = `${RECORD}%H${FIELD}%P${FIELD}%an${FIELD}%aI${FIELD}%s${FIELD}%b`;

/** A commit's message parts and metadata as {@link parseLog} reads them. */
export interface LoggedCommit extends DeltaCommitMeta {
	parents: string[];
	body: string;
	coAuthors: string[];
}

/**
 * Reads `git log --format=LOG_FORMAT` output into commits, newest first as git printed them.
 *
 * @param output What git printed.
 * @returns One entry per record; a record missing its fields is skipped.
 */
export function parseLog(output: string): LoggedCommit[] {
	let commits: LoggedCommit[] = [];
	for (let record of output.split(RECORD)) {
		let fields = record.split(FIELD);
		if (fields.length < 6) continue;
		let [sha = "", parents = "", author = "", date = "", subject = ""] = fields;
		let message = readMessage(fields.slice(5).join(FIELD));
		commits.push({
			sha: sha.trim(),
			parents: parents.trim() === "" ? [] : parents.trim().split(" "),
			author,
			date,
			subject,
			body: message.body,
			coAuthors: message.coAuthors,
		});
	}
	return commits;
}

/** A trailer line that carries an email: `Token: Name <someone@host>`. */
const EMAIL_TRAILER = /^([A-Za-z][\w-]*):\s*(.*?)\s*<[^<>\s]+@[^<>\s]+>\s*$/;

/**
 * Splits a commit body into the text a visitor reads and the names in its `Co-Authored-By`
 * trailers. Every trailer that carries an email is removed, so no address reaches the build.
 *
 * @param raw The body as git printed it.
 * @returns The body without those trailers, trimmed, and the co-authors' names in order.
 * @example readMessage("Fix it\n\nCo-Authored-By: Ada <ada@example.com>") // { body: "Fix it", coAuthors: ["Ada"] }
 */
export function readMessage(raw: string): { body: string; coAuthors: string[] } {
	let coAuthors: string[] = [];
	let kept: string[] = [];
	for (let line of raw.split("\n")) {
		let trailer = EMAIL_TRAILER.exec(line.trim());
		if (trailer === null) {
			kept.push(line);
			continue;
		}
		let name = trailer[2]?.trim() ?? "";
		if (
			trailer[1]?.toLowerCase() === "co-authored-by" &&
			name !== "" &&
			!coAuthors.includes(name)
		) {
			coAuthors.push(name);
		}
	}
	return { body: kept.join("\n").trim(), coAuthors };
}

/**
 * Expands a numstat path, which names a rename as `dir/{old => new}/file` or `old => new`,
 * into the path before and after.
 *
 * @returns `[before, after]`, the same path twice for a file that kept its name.
 * @example expandRename("src/{a.ts => b.ts}") // ["src/a.ts", "src/b.ts"]
 */
export function expandRename(path: string): [string, string] {
	let braces = /^(.*)\{(.*) => (.*)\}(.*)$/.exec(path);
	if (braces !== null) {
		let [, head = "", from = "", to = "", tail = ""] = braces;
		let join = (middle: string) => `${head}${middle}${tail}`.replaceAll("//", "/");
		return [join(from), join(to)];
	}
	let arrow = path.split(" => ");
	if (arrow.length === 2) return [arrow[0]!, arrow[1]!];
	return [path, path];
}

/**
 * Reads the numstat lines `git show --numstat` prints before the patch, with every path made
 * relative to `root`. Paths outside `root` are dropped.
 *
 * @param output The numstat lines, anything after them ignored.
 * @param root The folder every kept path lives under, with its trailing slash.
 */
export function parseNumstat(output: string, root: string): DeltaChangedFile[] {
	let files: DeltaChangedFile[] = [];
	for (let line of output.split("\n")) {
		let match = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
		if (match === null) continue;
		let [before, after] = expandRename(match[3]!);
		if (!after.startsWith(root)) continue;
		let binary = match[1] === "-";
		let file: DeltaChangedFile = {
			path: after.slice(root.length),
			additions: binary ? null : Number(match[1]),
			deletions: binary ? null : Number(match[2]),
		};
		if (before !== after)
			file.oldPath = before.startsWith(root) ? before.slice(root.length) : before;
		files.push(file);
	}
	return files;
}

/** The header lines of a file patch whose paths are rewritten relative to Delta's root. */
const PATH_LINES = /^(diff --git |--- |\+\+\+ |rename from |rename to |copy from |copy to )/;

/**
 * Cuts a commit's patch to what the build keeps: each file's paths made relative to `root`,
 * and any file whose patch passes `limit` bytes dropped and listed instead.
 *
 * @param patch The patch text, starting at its first `diff --git` line.
 * @param root The folder Delta's paths live under, with its trailing slash.
 * @param limit Bytes one file's patch may take.
 */
export function capPatch(patch: string, root: string, limit: number): DeltaPatch {
	let start = patch.indexOf("diff --git ");
	if (start === -1) return { text: "", dropped: [] };
	let chunks = patch.slice(start).split(/(?=^diff --git )/m);
	let kept: string[] = [];
	let dropped: string[] = [];
	let encoder = new TextEncoder();
	for (let chunk of chunks) {
		let relative = chunk
			.split("\n")
			.map((line) => (PATH_LINES.test(line) ? line.replaceAll(root, "") : line))
			.join("\n");
		if (encoder.encode(relative).length > limit) {
			let path = /^diff --git a\/(.+?) b\//.exec(relative)?.[1] ?? "";
			dropped.push(path);
		} else {
			kept.push(relative);
		}
	}
	return { text: kept.join(""), dropped };
}

/** Blame's word for one line: which commit last changed it, and that commit's metadata. */
export interface BlameReading {
	ranges: DeltaBlameRange[];
	/** Metadata for every sha the ranges name, read from the porcelain headers, never an email. */
	commits: DeltaCommitMeta[];
}

/**
 * Compacts `git blame --porcelain` into runs of lines one commit last changed, keeping each
 * commit's author, date and summary so a commit outside the history cap still has a name.
 *
 * @param output What git printed.
 */
export function compactBlame(output: string): BlameReading {
	let byLine: string[] = [];
	let commits = new Map<string, DeltaCommitMeta>();
	let current: DeltaCommitMeta | undefined;
	let finalLine = 0;
	for (let line of output.split("\n")) {
		let header = /^([0-9a-f]{40}) \d+ (\d+)(?: \d+)?$/.exec(line);
		if (header !== null) {
			let sha = header[1]!;
			finalLine = Number(header[2]);
			current = commits.get(sha);
			if (current === undefined) {
				current = { sha, author: "", date: "", subject: "" };
				commits.set(sha, current);
			}
			byLine[finalLine] = sha;
			continue;
		}
		if (current === undefined || line.startsWith("\t")) continue;
		if (line.startsWith("author ")) current.author = line.slice(7);
		else if (line.startsWith("author-time ")) {
			current.date = new Date(Number(line.slice(12)) * 1000).toISOString();
		} else if (line.startsWith("summary ")) current.subject = line.slice(8);
	}
	let ranges: DeltaBlameRange[] = [];
	for (let line = 1; line < byLine.length; line++) {
		let sha = byLine[line];
		if (sha === undefined) continue;
		let last = ranges.at(-1);
		if (last !== undefined && last.sha === sha && last.end === line - 1) last.end = line;
		else ranges.push({ start: line, end: line, sha });
	}
	return { ranges, commits: [...commits.values()] };
}

/**
 * Resolves a seeded anchor against the pinned file: the first line containing `match`. An
 * anchor that no longer matches is outdated, and keeps the lines it cited at the commit it was
 * written against when `before` can read that commit's file.
 *
 * @param seed The anchor as written in the seed data.
 * @param text The file at the pinned commit, or `undefined` when the file is gone.
 * @param before The commit `written` names and the file as it was there, when known.
 */
export function resolveAnchor(
	seed: DeltaAnchorSeed,
	text: string | undefined,
	before?: { sha: string; text: string },
): DeltaAnchor {
	let span = Math.max(1, seed.span ?? 1);
	let found = text === undefined ? -1 : findLine(text, seed.match);
	if (found !== -1) {
		return { id: seed.id, path: seed.path, status: "current", start: found, end: found + span - 1 };
	}
	let outdated: DeltaAnchor = { id: seed.id, path: seed.path, status: "outdated" };
	if (before === undefined) return outdated;
	let start = findLine(before.text, seed.match);
	if (start === -1) return { ...outdated, sha: before.sha };
	let excerpt = before.text.split("\n").slice(start - 1, start - 1 + span);
	return { ...outdated, sha: before.sha, start, excerpt };
}

/** The 1-based number of the first line holding `match`, or -1. */
function findLine(text: string, match: string): number {
	let index = text.split("\n").findIndex((line) => line.includes(match));
	return index === -1 ? -1 : index + 1;
}

/**
 * Sums the documents' sizes and names the total, for the build to stop once they pass the
 * budget rather than quietly grow the Worker.
 *
 * @param documents Each document's serialized text, by file name.
 * @param budget Bytes the documents may add up to.
 */
export function checkBudget(
	documents: Record<string, string>,
	budget: number,
): { bytes: number; within: boolean } {
	let encoder = new TextEncoder();
	let bytes = Object.values(documents).reduce((sum, text) => sum + encoder.encode(text).length, 0);
	return { bytes, within: bytes <= budget };
}
