/**
 * Line and word diffs with git's histogram alignment, and unified diffs read and written as
 * plain JSON. Nothing here renders: a caller draws hunks however it likes, on a server, in a
 * build script or in a Worker request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
export type {
	Algorithm,
	DiffOptions,
	FileHeader,
	FilePatch,
	FileStatus,
	Hunk,
	Line,
	LineDiff,
	LineKind,
	PatchEntry,
	WordDiff,
	WordRange,
} from "./types.js";
export type { ParseHunksOptions } from "./parse.js";

export { diffLines } from "./diff-lines.js";
export { parseHunks, parsePatch } from "./parse.js";
export { stringifyPatch } from "./stringify.js";
export { diffWords } from "./words.js";
