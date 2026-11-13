/**
 * Reads a unified diff, as `git show --patch` or `git diff` print it, in two steps: one pass
 * over the whole text for every file's header and line counts, then each file's hunks only when
 * a caller asks for them. Lines are read with index slices; nothing backtracks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { FilePatch, Hunk, Line } from "./types.js";

import { stripPrefix, unquotePath } from "./paths.js";
import { markWords } from "./words.js";

/** A hunk header's four numbers and its section heading. */
interface HunkHeader {
	oldStart: number;
	oldLines: number;
	newStart: number;
	newLines: number;
	section?: string;
}

/** Options for `parseHunks`. */
export interface ParseHunksOptions {
	/**
	 * Compute word ranges for paired deleted and added lines.
	 * @default true
	 */
	words?: boolean;
}

/** Reads the decimal number at `text[at]`, answering `[value, offset past it]`, or -1 for none. */
function readNumber(text: string, at: number, end: number): [number, number] {
	let value = 0;
	let i = at;
	while (i < end) {
		let c = text.charCodeAt(i);
		if (c < 48 || c > 57) break;
		value = value * 10 + (c - 48);
		i++;
	}
	return i === at ? [-1, at] : [value, i];
}

/** Reads `start[,count]` at `text[at]`; a missing count means one line. */
function readRange(text: string, at: number, end: number): [number, number, number] {
	let [start, i] = readNumber(text, at, end);
	if (start < 0) return [-1, 0, at];
	if (text.charCodeAt(i) !== 44) return [start, 1, i];
	let [count, after] = readNumber(text, i + 1, end);
	return count < 0 ? [-1, 0, at] : [start, count, after];
}

/**
 * Parses `@@ -a,b +c,d @@ section` in `text[start, end)`.
 *
 * @returns The header, or `undefined` when the line is not a well-formed hunk header.
 */
function readHunkHeader(text: string, start: number, end: number): HunkHeader | undefined {
	let [oldStart, oldLines, i] = readRange(text, start + 4, end);
	if (oldStart < 0 || !text.startsWith(" +", i)) return undefined;
	let [newStart, newLines, j] = readRange(text, i + 2, end);
	if (newStart < 0 || !text.startsWith(" @@", j)) return undefined;
	let header: HunkHeader = { oldStart, oldLines, newStart, newLines };
	if (text.charCodeAt(j + 3) === 32 && j + 4 < end) header.section = text.slice(j + 4, end);
	return header;
}

/** Reads a header path that may be quoted, cutting a bare one at a tab, as git ends it with one. */
function readPath(text: string, start: number, end: number): string {
	if (text.charCodeAt(start) === 34) return unquotePath(text, start, end)[0];
	let tab = text.indexOf("\t", start);
	return text.slice(start, tab === -1 || tab > end ? end : tab);
}

/**
 * Reads both paths of a `diff --git a/x b/y` line from `text[start, end)`, the part after the
 * command. Bare paths may hold spaces, so equal names are found by symmetry first.
 */
function readGitPaths(text: string, start: number, end: number): [string, string] {
	if (text.charCodeAt(start) === 34) {
		let [old, after] = unquotePath(text, start, end);
		return [stripPrefix(old), stripPrefix(readPath(text, after + 1, end))];
	}
	if (text.charCodeAt(end - 1) === 34) {
		let quote = text.lastIndexOf(' "', end);
		return [stripPrefix(text.slice(start, quote)), stripPrefix(readPath(text, quote + 1, end))];
	}
	let length = end - start;
	let half = (length - 1) >> 1;
	if (
		length % 2 === 1 &&
		text.charCodeAt(start + half) === 32 &&
		text.slice(start + 2, start + half) === text.slice(start + half + 3, end)
	) {
		let path = text.slice(start + 2, start + half);
		return [path, path];
	}
	let split = text.indexOf(" b/", start);
	if (split === -1 || split >= end) split = text.indexOf(" ", start);
	return [stripPrefix(text.slice(start, split)), stripPrefix(text.slice(split + 1, end))];
}

/** Creates the record for a file whose first header line ends at `next`. */
function newFile(oldPath: string, newPath: string, next: number): FilePatch {
	return {
		oldPath,
		newPath,
		status: "modified",
		binary: false,
		additions: 0,
		deletions: 0,
		bodyStart: next,
		bodyEnd: next,
	};
}

/** The extended header lines git writes between `diff --git` and the first hunk. */
const HEADER_KEYS = [
	"old mode ",
	"new mode ",
	"deleted file mode ",
	"new file mode ",
	"similarity index ",
	"dissimilarity index ",
	"rename from ",
	"rename to ",
	"copy from ",
	"copy to ",
	"index ",
	"--- ",
	"+++ ",
] as const;

/** Applies one extended header line to `file`, given the offset its value starts at. */
function applyHeader(
	file: FilePatch,
	key: (typeof HEADER_KEYS)[number],
	text: string,
	at: number,
	end: number,
): void {
	let value = text.slice(at, end);
	switch (key) {
		case "old mode ":
			file.oldMode = value;
			break;
		case "new mode ":
			file.newMode = value;
			break;
		case "deleted file mode ":
			file.oldMode = value;
			file.status = "deleted";
			break;
		case "new file mode ":
			file.newMode = value;
			file.status = "added";
			break;
		case "similarity index ":
			file.similarity = Number.parseInt(value, 10);
			break;
		case "dissimilarity index ":
			file.dissimilarity = Number.parseInt(value, 10);
			break;
		case "rename from ":
		case "copy from ":
			file.oldPath = readPath(text, at, end);
			file.status = key === "rename from " ? "renamed" : "copied";
			break;
		case "rename to ":
		case "copy to ":
			file.newPath = readPath(text, at, end);
			break;
		case "index ":
			applyIndex(file, value);
			break;
		case "--- ":
		case "+++ ":
			applyPathLine(file, key === "--- ", readPath(text, at, end));
			break;
	}
}

/** Reads `index <old>..<new>[ <mode>]`; the mode means both sides share it. */
function applyIndex(file: FilePatch, value: string): void {
	let dots = value.indexOf("..");
	if (dots === -1) return;
	let space = value.indexOf(" ", dots);
	file.oldHash = value.slice(0, dots);
	file.newHash = value.slice(dots + 2, space === -1 ? value.length : space);
	if (space !== -1 && file.oldMode === undefined && file.newMode === undefined) {
		file.oldMode = value.slice(space + 1);
		file.newMode = file.oldMode;
	}
}

/**
 * Reads a `---` or `+++` path. Rename and copy lines name the paths more reliably, so they win;
 * `/dev/null` marks an absent side.
 */
function applyPathLine(file: FilePatch, old: boolean, path: string): void {
	if (path === "/dev/null") {
		if (file.status === "modified") file.status = old ? "added" : "deleted";
		return;
	}
	if (file.status === "renamed" || file.status === "copied") return;
	if (old) file.oldPath = stripPrefix(path);
	else file.newPath = stripPrefix(path);
}

/** Fills in the path a one-sided file lacks, so both paths always name the file. */
function finish(file: FilePatch): FilePatch {
	if (file.status === "added" && file.oldPath === "") file.oldPath = file.newPath;
	if (file.status === "deleted" && file.newPath === "") file.newPath = file.oldPath;
	return file;
}

/**
 * Reads every file of a unified diff: paths, status, modes, blob ids, similarity, and counts
 * of added and deleted lines. Hunks stay as offsets until `parseHunks` reads them. Text before
 * the first file and lines that fit no header are skipped, so a commit message may precede it.
 *
 * @example let files = parsePatch(await gitShow(sha)); // [{ newPath: "src/a.ts", additions: 3, … }]
 */
export function parsePatch(text: string): FilePatch[] {
	let files: FilePatch[] = [];
	let file: FilePatch | undefined;
	let inHeader = false;
	let oldLeft = 0;
	let newLeft = 0;
	let pos = 0;
	while (pos < text.length) {
		let newline = text.indexOf("\n", pos);
		let end = newline === -1 ? text.length : newline;
		let next = newline === -1 ? text.length : newline + 1;
		let c = text.charCodeAt(pos);
		if (file && (oldLeft > 0 || newLeft > 0)) {
			let counted = true;
			if (c === 32 || end === pos) {
				oldLeft--;
				newLeft--;
			} else if (c === 45) {
				oldLeft--;
				file.deletions++;
			} else if (c === 43) {
				newLeft--;
				file.additions++;
			} else if (c !== 92) {
				counted = false;
				oldLeft = 0;
				newLeft = 0;
			}
			if (counted) {
				file.bodyEnd = next;
				pos = next;
				continue;
			}
		}
		if (file && c === 92 && pos === file.bodyEnd && !inHeader) {
			file.bodyEnd = next;
		} else if (file && text.startsWith("@@ -", pos)) {
			let header = readHunkHeader(text, pos, end);
			if (header) {
				if (inHeader) file.bodyStart = pos;
				inHeader = false;
				oldLeft = header.oldLines;
				newLeft = header.newLines;
				file.bodyEnd = next;
			}
		} else if (text.startsWith("diff --git ", pos)) {
			if (file) files.push(finish(file));
			let [oldPath, newPath] = readGitPaths(text, pos + 11, end);
			file = newFile(oldPath, newPath, next);
			inHeader = true;
		} else if (
			(!file || !inHeader) &&
			text.startsWith("--- ", pos) &&
			text.startsWith("+++ ", next)
		) {
			if (file) files.push(finish(file));
			file = newFile("", "", next);
			inHeader = true;
			applyHeader(file, "--- ", text, pos + 4, end);
		} else if (file && inHeader) {
			applyHeaderLine(file, text, pos, end);
			file.bodyStart = next;
			file.bodyEnd = next;
		}
		pos = next;
	}
	if (file) files.push(finish(file));
	return files;
}

/** Applies the extended header line at `text[pos, end)`, marking binary content as such. */
function applyHeaderLine(file: FilePatch, text: string, pos: number, end: number): void {
	if (text.startsWith("Binary files ", pos) || text.startsWith("GIT binary patch", pos)) {
		file.binary = true;
		return;
	}
	for (let key of HEADER_KEYS) {
		if (text.startsWith(key, pos)) {
			applyHeader(file, key, text, pos + key.length, end);
			return;
		}
	}
}

/**
 * Reads the hunks of one file returned by `parsePatch` on the same `text`. Each line carries its
 * old and new line numbers, and `\ No newline at end of file` marks the line before it.
 *
 * @example let hunks = parseHunks(text, files[0]); // [{ oldStart: 12, lines: [...] }]
 */
export function parseHunks(text: string, file: FilePatch, options: ParseHunksOptions = {}): Hunk[] {
	let hunks: Hunk[] = [];
	let hunk: Hunk | undefined;
	let last: Line | undefined;
	let oldNumber = 0;
	let newNumber = 0;
	let oldLeft = 0;
	let newLeft = 0;
	let pos = file.bodyStart;
	while (pos < file.bodyEnd) {
		let newline = text.indexOf("\n", pos);
		let end = newline === -1 || newline > file.bodyEnd ? file.bodyEnd : newline;
		let next = end + 1;
		let c = text.charCodeAt(pos);
		let header =
			c === 64 && text.startsWith("@@ -", pos) ? readHunkHeader(text, pos, end) : undefined;
		if (header) {
			hunk = { ...header, lines: [] };
			hunks.push(hunk);
			oldNumber = header.oldStart;
			newNumber = header.newStart;
			oldLeft = header.oldLines;
			newLeft = header.newLines;
			last = undefined;
		} else if (hunk && c === 92) {
			if (last) last.noNewline = true;
		} else if (hunk && (oldLeft > 0 || newLeft > 0)) {
			let content = text.slice(pos + 1, end);
			if (c === 45) {
				last = { kind: "del", text: content, old: oldNumber++ };
				oldLeft--;
			} else if (c === 43) {
				last = { kind: "add", text: content, new: newNumber++ };
				newLeft--;
			} else {
				last = { kind: "context", text: content, old: oldNumber++, new: newNumber++ };
				oldLeft--;
				newLeft--;
			}
			hunk.lines.push(last);
		}
		pos = next;
	}
	if (options.words !== false) for (let each of hunks) markWords(each.lines);
	return hunks;
}
