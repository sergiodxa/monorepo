/**
 * Delta's own source and history as the Worker reads them: the files, commits, patches, blame
 * and anchors `scripts/extract-delta.ts` baked from git, each loaded on the first request that
 * needs it, with tokenizing and patch parsing memoized per isolate by path and commit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FilePatch, Hunk } from "@sdxc/diff";
import type { Line } from "@sdxc/highlight";

import { parseHunks, parsePatch } from "@sdxc/diff";
import { tokenizeLines } from "@sdxc/highlight";

import { unapplyHunks } from "./hunks";

/** One file at the pinned commit. */
export interface DeltaFile {
	/** Relative to `DELTA_ROOT`, such as `shell.tsx` or `screens/blob.tsx`. */
	path: string;
	text: string;
	/** Size in bytes as UTF-8. */
	bytes: number;
	/** Lines as a code view numbers them, a trailing newline not counted. */
	lines: number;
}

/** The pinned commit's tree: every file, and the last commit touching each file and folder. */
export interface DeltaTree {
	/** The commit every document describes. */
	head: string;
	files: DeltaFile[];
	/** Sha of the newest commit touching each path; folders included, `""` for the root. */
	lastCommits: Record<string, string>;
}

/** A commit as the commits list and the blame column name it, without any email. */
export interface DeltaCommitMeta {
	sha: string;
	author: string;
	/** ISO 8601 author date. */
	date: string;
	subject: string;
}

/** One file a commit changed, from its numstat. */
export interface DeltaChangedFile {
	/** The path after the commit, relative to `DELTA_ROOT`. */
	path: string;
	/** The path before a rename. */
	oldPath?: string;
	/** `null` for a binary file. */
	additions: number | null;
	deletions: number | null;
}

/** A commit inside the history cap, with its message and the files it changed. */
export interface DeltaCommit extends DeltaCommitMeta {
	parents: string[];
	/** The message after the subject, with every email-bearing trailer removed. */
	body: string;
	/** Names from `Co-Authored-By` trailers, in the order written. */
	coAuthors: string[];
	files: DeltaChangedFile[];
}

/** The history the build read. */
export interface DeltaHistory {
	head: string;
	/** The checkout had no full history, so `commits` is empty on purpose. */
	shallow: boolean;
	/** More commits touch Delta than `DELTA_HISTORY_LIMIT`, so the oldest are left out. */
	capped: boolean;
	/** Newest first. */
	commits: DeltaCommit[];
	/** Commits outside the cap that blame or a file's last commit names, metadata only. */
	cited: DeltaCommitMeta[];
}

/** One commit's unified diff, limited to Delta's files, with paths relative to its root. */
export interface DeltaPatch {
	text: string;
	/** Paths whose patch passed `DELTA_PATCH_FILE_LIMIT` and were left out of `text`. */
	dropped: string[];
}

/** A run of lines, counted from 1, last changed by one commit. */
export interface DeltaBlameRange {
	start: number;
	end: number;
	sha: string;
}

/**
 * A seeded issue, thread or annotation's citation, written by content so it survives edits:
 * the first line containing `match`, and the `span - 1` lines after it.
 */
export interface DeltaAnchorSeed {
	id: string;
	path: string;
	match: string;
	/** @default 1 */
	span?: number;
	/** Subject of the commit the citation was written against, for its excerpt once outdated. */
	written?: string;
}

/** An anchor as the build resolved it against the pinned files. */
export type DeltaAnchor =
	| { id: string; path: string; status: "current"; start: number; end: number }
	| {
			id: string;
			path: string;
			status: "outdated";
			/** The commit the excerpt comes from, when `written` named one the build knows. */
			sha?: string;
			start?: number;
			excerpt?: string[];
	  };

/** Every document the build writes, by file name. */
export interface DeltaDocuments {
	tree: DeltaTree;
	history: DeltaHistory;
	patches: Record<string, DeltaPatch>;
	blame: Record<string, DeltaBlameRange[]>;
	anchors: Record<string, DeltaAnchor>;
}

/**
 * Every generated document, each its own lazy chunk, so a request for the file list never
 * loads a megabyte of patches.
 */
const DOCUMENTS = import.meta.glob("../../../resources/generated/delta/*.json", {
	import: "default",
});

/** Each document once loaded, per isolate. */
let loaded = new Map<string, Promise<unknown>>();

/**
 * Loads one generated document. A missing document, as before the extractor first runs,
 * reads as `fallback`, so every screen still renders its empty state.
 */
function load<Name extends keyof DeltaDocuments>(
	name: Name,
	fallback: DeltaDocuments[Name],
): Promise<DeltaDocuments[Name]> {
	let cached = loaded.get(name);
	if (cached !== undefined) return cached as Promise<DeltaDocuments[Name]>;
	let importer = DOCUMENTS[`../../../resources/generated/delta/${name}.json`];
	let promise =
		importer === undefined
			? Promise.resolve(fallback)
			: (importer() as Promise<DeltaDocuments[Name]>);
	loaded.set(name, promise);
	return promise;
}

/** The pinned tree; empty before the extractor has run. */
export function readTree(): Promise<DeltaTree> {
	return load("tree", { head: "", files: [], lastCommits: {} });
}

/** The capped history; empty and unflagged before the extractor has run. */
export function readHistory(): Promise<DeltaHistory> {
	return load("history", { head: "", shallow: false, capped: false, commits: [], cited: [] });
}

/** Blame ranges per file path. */
export function readBlame(): Promise<Record<string, DeltaBlameRange[]>> {
	return load("blame", {});
}

/** Every seeded anchor as resolved at build time, by id. */
export function readAnchors(): Promise<Record<string, DeltaAnchor>> {
	return load("anchors", {});
}

/** One commit's patch, or `undefined` for a commit outside the history cap. */
export async function readPatch(sha: string): Promise<DeltaPatch | undefined> {
	let patches = await load("patches", {});
	return Object.hasOwn(patches, sha) ? patches[sha] : undefined;
}

/**
 * Finds a commit by its full or abbreviated sha (seven characters at least) among the
 * history and the cited commits.
 *
 * @returns The full commit, the metadata of a cited one, or `undefined`.
 */
export async function findCommit(sha: string): Promise<DeltaCommit | DeltaCommitMeta | undefined> {
	if (!/^[0-9a-f]{7,40}$/.test(sha)) return undefined;
	let history = await readHistory();
	return (
		history.commits.find((commit) => commit.sha.startsWith(sha)) ??
		history.cited.find((commit) => commit.sha.startsWith(sha))
	);
}

/** Whether a commit carries its message and files, rather than its metadata alone. */
export function isFullCommit(commit: DeltaCommit | DeltaCommitMeta): commit is DeltaCommit {
	return "files" in commit;
}

/** Every commit by sha: the history and the cited ones, built once per isolate. */
let commitIndex: Promise<Map<string, DeltaCommit | DeltaCommitMeta>> | undefined;

/** Every commit Delta knows by its full sha, for blame and file rows to name. */
export function commitsBySha(): Promise<Map<string, DeltaCommit | DeltaCommitMeta>> {
	commitIndex ??= readHistory().then(
		(history) =>
			new Map<string, DeltaCommit | DeltaCommitMeta>(
				[...history.cited, ...history.commits].map((commit) => [commit.sha, commit]),
			),
	);
	return commitIndex;
}

/** The highlight grammar a path's extension names; an unknown extension draws plain. */
export function languageOf(path: string): string | undefined {
	let extension = /\.([a-z0-9]+)$/i.exec(path)?.[1]?.toLowerCase();
	if (extension === undefined) return undefined;
	let known: Record<string, string> = {
		ts: "ts",
		tsx: "tsx",
		js: "js",
		jsx: "jsx",
		css: "css",
		json: "json",
		md: "md",
		html: "html",
		yaml: "yaml",
		yml: "yaml",
		sh: "sh",
	};
	return known[extension];
}

/** Tokenized files, keyed by `sha:path`, so each file is tokenized once per isolate. */
let tokenized = new Map<string, Line[]>();

/**
 * A file's lines as `@sdxc/highlight` tokenizes them, each carrying the state it ends in so a
 * later chunk can resume. Memoized per `(path, sha)`: the first request pays, later ones reuse.
 *
 * @param file The file at `sha`.
 * @param sha The commit the text was read at.
 */
export function fileLines(file: DeltaFile, sha: string): Line[] {
	let key = `${sha}:${file.path}`;
	let cached = tokenized.get(key);
	if (cached !== undefined) return cached;
	let language = languageOf(file.path) ?? "plain";
	let lines = tokenizeLines(file.text.replace(/\r?\n$/, ""), language);
	tokenized.set(key, lines);
	return lines;
}

/**
 * A file's runs as one flat list, newlines between lines, the shape a code view paints.
 *
 * @param file The file at `sha`.
 * @param sha The commit the text was read at.
 */
export function fileTokens(file: DeltaFile, sha: string): Array<{ type: string; value: string }> {
	let runs: Array<{ type: string; value: string }> = [];
	let lines = fileLines(file, sha);
	lines.forEach((line, index) => {
		if (index > 0) runs.push({ type: "plain", value: "\n" });
		runs.push(...line.tokens);
	});
	return runs;
}

/** Parsed patches by commit, so a commit's headers are read once per isolate. */
let parsedPatches = new Map<string, { text: string; files: FilePatch[] }>();

/** Parsed hunks keyed by `sha:path`. */
let parsedHunks = new Map<string, Hunk[]>();

/**
 * The file headers of one commit's patch, parsed once per isolate. Hunks wait for
 * {@link fileHunks}, so a commit touching forty files parses only the ones a page draws.
 *
 * @returns The headers, or `undefined` for a commit whose patch the build does not hold.
 */
export async function commitFiles(sha: string): Promise<FilePatch[] | undefined> {
	let cached = parsedPatches.get(sha);
	if (cached !== undefined) return cached.files;
	let patch = await readPatch(sha);
	if (patch === undefined) return undefined;
	let parsed = { text: patch.text, files: parsePatch(patch.text) };
	parsedPatches.set(sha, parsed);
	return parsed.files;
}

/**
 * One file's hunks in one commit, with word ranges on paired lines, parsed once per
 * `(path, sha)` per isolate.
 *
 * @returns The hunks, or `undefined` when the commit's patch holds no such file.
 */
export async function fileHunks(sha: string, path: string): Promise<Hunk[] | undefined> {
	let key = `${sha}:${path}`;
	let cached = parsedHunks.get(key);
	if (cached !== undefined) return cached;
	await commitFiles(sha);
	let parsed = parsedPatches.get(sha);
	let file = parsed?.files.find((candidate) => candidate.newPath === path);
	if (parsed === undefined || file === undefined) return undefined;
	let hunks = parseHunks(parsed.text, file);
	parsedHunks.set(key, hunks);
	return hunks;
}

/** Files as they were after a commit, keyed by `sha:path`. */
let filesAt = new Map<string, Promise<string[] | undefined>>();

/**
 * A file's lines as they stood right after a commit in the history, rebuilt from the pinned
 * file by walking every later commit's patch of it backwards, renames included. Memoized per
 * `(sha, path)`, so expanding context on one file pays the walk once per isolate.
 *
 * @param sha A commit inside the history.
 * @param path The file's path at that commit.
 * @returns The lines, or `undefined` when a later patch was dropped for size or the commit is
 *   outside the history, so the walk cannot be trusted.
 */
export function fileLinesAt(sha: string, path: string): Promise<string[] | undefined> {
	let key = `${sha}:${path}`;
	let cached = filesAt.get(key);
	if (cached !== undefined) return cached;
	let promise = walkBack(sha, path);
	filesAt.set(key, promise);
	return promise;
}

/** Walks a file back from the pinned commit to `sha`, as {@link fileLinesAt} answers. */
async function walkBack(sha: string, path: string): Promise<string[] | undefined> {
	let [tree, history] = await Promise.all([readTree(), readHistory()]);
	let stop = history.commits.findIndex((commit) => commit.sha === sha);
	if (stop === -1) return undefined;
	let later = history.commits.slice(0, stop);
	let names = new Map<string, string>();
	let current = path;
	for (let commit of [...later].reverse()) {
		let change = commit.files.find((file) => (file.oldPath ?? file.path) === current);
		if (change !== undefined) current = change.path;
		names.set(commit.sha, current);
	}
	let file = tree.files.find((candidate) => candidate.path === current);
	let lines = file === undefined ? [] : file.text.replace(/\r?\n$/, "").split(/\r?\n/);
	for (let commit of later) {
		let name = names.get(commit.sha) ?? path;
		let change = commit.files.find((candidate) => candidate.path === name);
		if (change === undefined) continue;
		let hunks = await fileHunks(commit.sha, name);
		if (hunks === undefined) return undefined;
		lines = unapplyHunks(lines, hunks);
	}
	return lines;
}
