/**
 * Writes files and hunks back out as a git-style unified diff, in the header order and number
 * format git uses, so what `parsePatch` read from `git show` comes back byte for byte and the
 * output applies with `git apply`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Hunk, PatchEntry } from "./types.js";

import { quotePath } from "./paths.js";

/** The mode a header falls back to for a one-sided file that names none. */
const REGULAR_FILE = "100644";

/** The marker each line kind starts with. */
const SIGNS = { add: "+", del: "-", context: " " } as const;

/** Writes a hunk range the way git does, dropping the count when it is one. */
function range(start: number, count: number): string {
	return count === 1 ? `${start}` : `${start},${count}`;
}

/** Git ends a `---` or `+++` path holding a space with a tab, so the path's end is unambiguous. */
function tabAfter(name: string, path: string): string {
	return name !== "/dev/null" && path.includes(" ") ? "\t" : "";
}

/** Appends one hunk's header and lines to `out`. */
function writeHunk(out: string[], hunk: Hunk): void {
	let section = hunk.section ? ` ${hunk.section}` : "";
	out.push(
		`@@ -${range(hunk.oldStart, hunk.oldLines)} +${range(hunk.newStart, hunk.newLines)} @@${section}`,
	);
	for (let line of hunk.lines) {
		out.push(SIGNS[line.kind] + line.text);
		if (line.noNewline) out.push("\\ No newline at end of file");
	}
}

/** Appends the mode, similarity, rename and index lines git writes after `diff --git`. */
function writeExtendedHeader(out: string[], entry: PatchEntry): void {
	if (entry.status === "added") {
		out.push(`new file mode ${entry.newMode ?? REGULAR_FILE}`);
	} else if (entry.status === "deleted") {
		out.push(`deleted file mode ${entry.oldMode ?? REGULAR_FILE}`);
	} else if (entry.oldMode && entry.newMode && entry.oldMode !== entry.newMode) {
		out.push(`old mode ${entry.oldMode}`, `new mode ${entry.newMode}`);
	}
	if (entry.similarity !== undefined) out.push(`similarity index ${entry.similarity}%`);
	if (entry.dissimilarity !== undefined) out.push(`dissimilarity index ${entry.dissimilarity}%`);
	if (entry.status === "renamed" || entry.status === "copied") {
		let verb = entry.status === "renamed" ? "rename" : "copy";
		out.push(`${verb} from ${quotePath(entry.oldPath)}`, `${verb} to ${quotePath(entry.newPath)}`);
	}
	if (entry.oldHash !== undefined && entry.newHash !== undefined) {
		let shared =
			entry.status !== "added" &&
			entry.status !== "deleted" &&
			entry.oldMode !== undefined &&
			entry.oldMode === entry.newMode;
		out.push(`index ${entry.oldHash}..${entry.newHash}${shared ? ` ${entry.oldMode}` : ""}`);
	}
}

/**
 * Writes entries as one unified diff. A binary entry gets git's `Binary files … differ` line,
 * and an entry without hunks (a pure rename or a mode change) gets its headers only.
 *
 * @example stringifyPatch([{ oldPath: "a.ts", newPath: "a.ts", status: "modified", binary: false, hunks }]);
 */
export function stringifyPatch(entries: readonly PatchEntry[]): string {
	let out: string[] = [];
	for (let entry of entries) {
		let oldName = quotePath(`a/${entry.oldPath}`);
		let newName = quotePath(`b/${entry.newPath}`);
		out.push(`diff --git ${oldName} ${newName}`);
		writeExtendedHeader(out, entry);
		let from = entry.status === "added" ? "/dev/null" : oldName;
		let to = entry.status === "deleted" ? "/dev/null" : newName;
		if (entry.binary) {
			out.push(`Binary files ${from} and ${to} differ`);
		} else if (entry.hunks.length > 0) {
			out.push(
				`--- ${from}${tabAfter(from, entry.oldPath)}`,
				`+++ ${to}${tabAfter(to, entry.newPath)}`,
			);
			for (let hunk of entry.hunks) writeHunk(out, hunk);
		}
	}
	return out.length === 0 ? "" : `${out.join("\n")}\n`;
}
