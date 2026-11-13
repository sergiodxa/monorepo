/**
 * The plain data every function in the package reads and writes: lines, hunks, file headers
 * and options. Every value is JSON-serializable, so a diff computed once can be cached,
 * sent over the wire and rendered anywhere.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Whether a line is shared by both sides, added on the new side or deleted from the old. */
export type LineKind = "context" | "add" | "del";

/**
 * A changed span inside one line, as `[start, end)` UTF-16 offsets into `Line.text`, so
 * `text.slice(start, end)` is the changed text.
 */
export type WordRange = [start: number, end: number];

/** How a file changed between the two sides of a patch. */
export type FileStatus = "added" | "modified" | "deleted" | "renamed" | "copied";

/** The line-alignment strategy `diffLines` uses. */
export type Algorithm = "histogram" | "myers";

/** One line of a hunk. */
export interface Line {
	kind: LineKind;
	/** 1-based line number on the old side; present on `context` and `del` lines. */
	old?: number;
	/** 1-based line number on the new side; present on `context` and `add` lines. */
	new?: number;
	/** The line's content, without its line terminator. */
	text: string;
	/**
	 * The spans that changed against the line it pairs with: removed spans on a `del` line,
	 * added spans on an `add` line. Absent when the line has no pair or the word diff was
	 * skipped, which means the whole line is the change.
	 */
	words?: WordRange[];
	/** The line is the last on its side and that side ends without a newline. */
	noNewline?: boolean;
}

/** A contiguous window of changes with the context lines around them. */
export interface Hunk {
	/** 1-based first old line; when `oldLines` is 0, the line the insertion follows. */
	oldStart: number;
	oldLines: number;
	/** 1-based first new line; when `newLines` is 0, the line the deletion follows. */
	newStart: number;
	newLines: number;
	/** The text after the closing `@@`, usually the enclosing function's signature. */
	section?: string;
	lines: Line[];
}

/** What a unified diff says about one file apart from its hunks. */
export interface FileHeader {
	/** The path on the old side; equals `newPath` for added, modified and deleted files. */
	oldPath: string;
	/** The path on the new side; equals `oldPath` for added, modified and deleted files. */
	newPath: string;
	status: FileStatus;
	/** Git declared the content binary, so the file carries no hunks. */
	binary: boolean;
	/** Octal file mode on the old side, such as `"100644"`. */
	oldMode?: string;
	/** Octal file mode on the new side, such as `"100755"`. */
	newMode?: string;
	/** Abbreviated blob id on the old side, from the `index` line. */
	oldHash?: string;
	/** Abbreviated blob id on the new side, from the `index` line. */
	newHash?: string;
	/** Percentage of content a rename or copy kept. */
	similarity?: number;
	/** Percentage of content a complete rewrite replaced. */
	dissimilarity?: number;
}

/**
 * One file of a parsed patch. Its hunks stay unparsed until `parseHunks` reads them from
 * `text.slice(bodyStart, bodyEnd)`, so listing a large patch costs one pass over its text.
 */
export interface FilePatch extends FileHeader {
	additions: number;
	deletions: number;
	/** Offset of the file's first `@@` line in the patch text. */
	bodyStart: number;
	/** Offset just past the file's last hunk line; equals `bodyStart` when there are none. */
	bodyEnd: number;
}

/** One file to write with `stringifyPatch`: its header and its hunks. */
export interface PatchEntry extends FileHeader {
	hunks: Hunk[];
}

/** Options for `diffLines`. */
export interface DiffOptions {
	/**
	 * `"histogram"` anchors on lines that are rare on both sides, as
	 * `git diff --histogram` does; `"myers"` finds a minimal edit script.
	 * @default "histogram"
	 */
	algorithm?: Algorithm;
	/**
	 * Unchanged lines kept around each change; changes closer than twice this share a hunk.
	 * @default 3
	 */
	context?: number;
	/**
	 * Comparison steps the alignment may spend before the rest of the input becomes one
	 * replace block and the result is marked `approximate`.
	 * @default 20_000_000
	 */
	maxCost?: number;
	/**
	 * Compute word ranges for paired deleted and added lines.
	 * @default true
	 */
	words?: boolean;
}

/** The result of `diffLines`. */
export interface LineDiff {
	hunks: Hunk[];
	additions: number;
	deletions: number;
	/**
	 * The cost cap was reached, so part of the input is shown as one replace block rather
	 * than aligned line by line. The hunks still turn the old text into the new one.
	 */
	approximate: boolean;
}

/** The spans that differ between two paired lines. */
export interface WordDiff {
	old: WordRange[];
	new: WordRange[];
}
