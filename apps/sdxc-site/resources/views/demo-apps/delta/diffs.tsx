/**
 * Delta's page of diffs, shared by a commit and a pull request's files: each file read from the
 * patch the build baked, its context widened on request from the file as it stood, large files
 * waiting behind "Load diff", and the unified or split view kept in the address.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FilePatch, FileStatus, Hunk } from "@sdxc/diff";
import type { Handle, RemixNode } from "remix/component";

import { LazyFrame } from "@sdxc/lazy-frame/ui";
import { raw } from "@sdxc/u/general";
import { Diff } from "@sdxc/ui/app/diff";

import type { DeltaChangedFile, DeltaCommit } from "~/app/services/delta/source";

import { EXPAND_STEP, expandHunks, hasHiddenLines } from "~/app/services/delta/hunks";
import {
	commitFiles,
	fileHunks,
	fileLinesAt,
	languageOf,
	readPatch,
} from "~/app/services/delta/source";
import { demoAppFrameHref } from "~/resources/views/demo-apps";

import { SLUG } from "./data";
import { DiffIsland } from "./diff-island";
import { COPY, DIFF_FILE_LABELS, DIFF_LABELS, DIFF_TOOLBAR_LABELS } from "./labels";

/** Changed lines past which a file waits behind "Load diff". */
export const LARGE_DIFF = 400;

/** The address one of Delta's frames loads from. */
const frameHref = demoAppFrameHref(SLUG);

/** Where a page's diffs come from: one commit's patch, or a pull request's range. */
export interface PatchSource {
	/** The part of the lazy frame that answers one large file: `diff/commit/<sha>`. */
	part: string;
	/** Every file the change touched, with its counts, in the order the patch lists them. */
	files: readonly DeltaChangedFile[];
	/** The parsed headers of the patch the build kept. */
	headers: readonly FilePatch[];
	/** Paths whose patch was dropped for size. */
	dropped: readonly string[];
	/** One file's hunks. */
	hunks: (path: string) => Promise<Hunk[] | undefined>;
	/** One file's lines on the new side, for widening its context; `undefined` when unknown. */
	lines: (path: string) => Promise<string[] | undefined>;
}

/**
 * One commit's patch as a page of diffs reads it, each file's lines on the new side rebuilt
 * from the pinned files for widening its context.
 */
export async function commitSource(commit: DeltaCommit): Promise<PatchSource> {
	let [headers, patch] = await Promise.all([commitFiles(commit.sha), readPatch(commit.sha)]);
	return {
		part: `diff/commit/${commit.sha}`,
		files: commit.files,
		headers: headers ?? [],
		dropped: patch?.dropped ?? [],
		hunks: (path) => fileHunks(commit.sha, path),
		lines: (path) => fileLinesAt(commit.sha, path),
	};
}

/** A dropped file's status, read from its counts since its header went with its patch. */
function guessStatus(file: DeltaChangedFile): FileStatus {
	if (file.oldPath !== undefined) return "renamed";
	return file.deletions === 0 ? "added" : "modified";
}

/** One file as the page draws it. */
export interface DiffFileView {
	/** The card's id, the prefix of every line anchor in it. */
	id: string;
	path: string;
	oldPath?: string;
	status: FileStatus;
	additions: number;
	deletions: number;
	binary: boolean;
	tooLarge: boolean;
	/** The lines; absent for a file waiting behind "Load diff", a binary or a dropped one. */
	hunks?: Hunk[];
	/** Waits behind "Load diff" until the reader opens it. */
	lazy: boolean;
	language?: string;
	/** Where the expand link of this file's hunks goes; absent once every line shows. */
	expandHref?: string;
	/** The lazy frame's address and the no-script page that draws the file whole. */
	loadSrc?: string;
	loadHref?: string;
}

/** A page of diffs. */
export interface DiffView {
	view: Diff.View;
	files: DiffFileView[];
	additions: number;
	deletions: number;
}

/** A path as an id fragment: lowercase letters, digits and dashes. */
export function fileId(path: string): string {
	return `diff-${path.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

/** The view an address asks for; unified unless it says split. */
export function readView(url: URL): Diff.View {
	return url.searchParams.get("diff") === "split" ? "split" : "unified";
}

/** How many extra lines of context the address asks for around a file's hunks. */
function expandedBy(url: URL, path: string): number {
	let total = 0;
	for (let value of url.searchParams.getAll("expand")) {
		let colon = value.lastIndexOf(":");
		if (colon === -1 || value.slice(0, colon) !== path) continue;
		let lines = Number(value.slice(colon + 1));
		if (Number.isSafeInteger(lines) && lines > 0) total = Math.max(total, lines);
	}
	return Math.min(total, 10_000);
}

/** The page's address with one file's expansion set to `lines`, the rest of its query kept. */
function withExpansion(url: URL, path: string, lines: number): URL {
	let next = new URL(url);
	let kept = next.searchParams
		.getAll("expand")
		.filter((value) => value.slice(0, value.lastIndexOf(":")) !== path);
	next.searchParams.delete("expand");
	for (let value of [...kept, `${path}:${lines}`]) next.searchParams.append("expand", value);
	next.searchParams.delete("toast");
	return next;
}

/** The page's address with one more file drawn whole, the rest of its query kept. */
function withLoaded(url: URL, path: string): URL {
	let next = new URL(url);
	if (!next.searchParams.getAll("load").includes(path)) next.searchParams.append("load", path);
	next.searchParams.delete("toast");
	return next;
}

/** An address as a link writes it: path, query and an optional fragment. */
function local(url: URL, hash?: string): string {
	return `${url.pathname}${url.search}${hash === undefined ? "" : `#${hash}`}`;
}

/**
 * Reads one file of a change as the page draws it: its hunks, widened by what the address
 * asks, or a lazy placeholder for a large file the reader hasn't loaded.
 *
 * @param source Where the change's patch comes from.
 * @param file The file, with its counts.
 * @param url The page's address, which carries the view, expansions and loaded files.
 * @param force Draws the file's lines even when it is large, as its lazy frame does.
 */
export async function readDiffFile(
	source: PatchSource,
	file: DeltaChangedFile,
	url: URL,
	force = false,
): Promise<DiffFileView> {
	let header = source.headers.find((candidate) => candidate.newPath === file.path);
	let tooLarge = source.dropped.includes(file.path);
	let binary = header?.binary === true || file.additions === null;
	let additions = file.additions ?? 0;
	let deletions = file.deletions ?? 0;
	let status = header?.status ?? guessStatus(file);
	let id = fileId(file.path);
	let base: DiffFileView = {
		id,
		path: file.path,
		oldPath:
			file.oldPath ?? (header && header.oldPath !== header.newPath ? header.oldPath : undefined),
		status,
		additions,
		deletions,
		binary,
		tooLarge,
		lazy: false,
		language: languageOf(file.path),
	};
	if (binary || tooLarge || header === undefined) return base;
	let large = additions + deletions > LARGE_DIFF;
	if (large && !force && !url.searchParams.getAll("load").includes(file.path)) {
		let query = new URLSearchParams();
		query.set("path", file.path);
		for (let name of ["diff", "expand", "load"]) {
			for (let value of url.searchParams.getAll(name)) query.append(name, value);
		}
		query.set("page", url.pathname);
		return {
			...base,
			lazy: true,
			loadSrc: frameHref(`${source.part}?${query}`),
			loadHref: local(withLoaded(url, file.path), id),
		};
	}
	let parsed = (await source.hunks(file.path)) ?? [];
	let extra = expandedBy(url, file.path);
	let canWiden = status === "modified" || status === "renamed";
	let lines = canWiden ? await source.lines(file.path) : undefined;
	let hunks = lines === undefined ? parsed : expandHunks(parsed, lines, extra);
	let more = lines !== undefined && hasHiddenLines(hunks, lines);
	let page = large ? withLoaded(url, file.path) : url;
	return {
		...base,
		hunks,
		expandHref: more ? local(withExpansion(page, file.path, extra + EXPAND_STEP), id) : undefined,
	};
}

/**
 * Reads every file of a change as the page draws it.
 *
 * @param source Where the change's patch comes from.
 * @param url The page's address.
 */
export async function readDiff(source: PatchSource, url: URL): Promise<DiffView> {
	let files = await Promise.all(source.files.map((file) => readDiffFile(source, file, url)));
	return {
		view: readView(url),
		files,
		additions: files.reduce((sum, file) => sum + file.additions, 0),
		deletions: files.reduce((sum, file) => sum + file.deletions, 0),
	};
}

/** The page's address with the view set, for the toolbar's switch. */
export function viewHref(url: URL, view: Diff.View): string {
	let next = new URL(url);
	next.searchParams.delete("toast");
	if (view === "unified") next.searchParams.delete("diff");
	else next.searchParams.set("diff", view);
	return local(next);
}

namespace DiffFile {
	export interface Props {
		file: DiffFileView;
		view: Diff.View;
		/** What the file's card carries beyond its lines, such as threads and "Viewed". */
		extra?: Partial<Diff.FileProps>;
	}
}

/**
 * Renders one file's card. A large file renders closed, and opening it fetches its lines
 * through a lazy frame; without script its "Load diff" link draws the page with it whole.
 */
export function DiffFile(handle: Handle<DiffFile.Props>) {
	return () => {
		let { extra, file, view } = handle.props;
		let expand = file.expandHref;
		return (
			<Diff.File
				id={file.id}
				path={file.path}
				oldPath={file.oldPath}
				status={file.status}
				additions={file.additions}
				deletions={file.deletions}
				binary={file.binary}
				tooLarge={file.tooLarge}
				hunks={file.hunks}
				language={file.language}
				view={view}
				largeThreshold={LARGE_DIFF}
				expandHref={expand === undefined ? undefined : () => expand}
				load={
					file.lazy && file.loadSrc !== undefined ? (
						<LazyFrame src={file.loadSrc} loadOn="open">
							<a href={file.loadHref} data-delta-load="" mix={[loadLink()]}>
								{COPY.commit.loadDiff}
							</a>
						</LazyFrame>
					) : undefined
				}
				labels={DIFF_FILE_LABELS}
				{...extra}
			/>
		);
	};
}

/** "Load diff" as a quiet outlined button. */
function loadLink() {
	return raw({
		display: "inline-flex",
		alignItems: "center",
		minBlockSize: "2rem",
		paddingInline: "0.75rem",
		border: "1px solid var(--ui-neutral-border)",
		borderRadius: "var(--ui-radius-md)",
		color: "var(--ui-brand-fg, var(--ui-neutral-fg-emphasis))",
		fontWeight: 500,
		textDecoration: "none",
		"&:hover": { backgroundColor: "var(--ui-neutral-bg-tint-hover)" },
	});
}

namespace DiffPage {
	export interface Props {
		diff: DiffView;
		url: URL;
		/** Controls between the view switch and the progress, such as the change's summary. */
		toolbar?: RemixNode;
		/** Files viewed, for "n / N files viewed". */
		viewed?: number;
		/** What each file's card carries beyond its lines. */
		extra?: (file: DiffFileView) => Partial<Diff.FileProps>;
		/** The page takes review comments, so a line's `+` opens the inline form. */
		comments?: boolean;
		/** Markup after the files inside the diff root, such as the comment form's template. */
		children?: RemixNode;
	}
}

/**
 * Renders the toolbar and every file's card inside one diff root, with the island that keeps
 * expanding in place. A file loaded through its lazy frame sheds the note that stood in for it.
 */
export function DiffPage(handle: Handle<DiffPage.Props>) {
	return () => {
		let { children, comments, diff, extra, toolbar, url, viewed } = handle.props;
		return (
			<Diff
				labels={DIFF_LABELS}
				mix={[
					raw({
						"& [data-slot='diff-file-note']:has([data-slot='diff-hunks'])": {
							display: "block",
							padding: 0,
							textAlign: "start",
							"& > p": { display: "none" },
						},
					}),
				]}
			>
				<Diff.Toolbar
					view={diff.view}
					unifiedHref={viewHref(url, "unified")}
					splitHref={viewHref(url, "split")}
					viewed={viewed}
					total={viewed === undefined ? undefined : diff.files.length}
					labels={DIFF_TOOLBAR_LABELS}
				>
					{toolbar}
				</Diff.Toolbar>
				{diff.files.map((file) => (
					<DiffFile file={file} view={diff.view} extra={extra?.(file)} />
				))}
				{children}
				<DiffIsland comments={comments} />
			</Diff>
		);
	};
}

namespace LazyHunks {
	export interface Props {
		file: DiffFileView;
		view: Diff.View;
		threads?: Readonly<Record<string, RemixNode>>;
		commentHref?: Diff.HunksProps["commentHref"];
	}
}

/** Renders a large file's lines alone, as its lazy frame answers once the reader opens it. */
export function LazyHunks(handle: Handle<LazyHunks.Props>) {
	return () => {
		let { commentHref, file, threads, view } = handle.props;
		let expand = file.expandHref;
		return (
			<Diff.Hunks
				path={file.path}
				hunks={file.hunks ?? []}
				language={file.language}
				view={view}
				fileId={file.id}
				threads={threads}
				commentHref={commentHref}
				expandHref={expand === undefined ? undefined : () => expand}
				labels={DIFF_FILE_LABELS}
			/>
		);
	};
}
