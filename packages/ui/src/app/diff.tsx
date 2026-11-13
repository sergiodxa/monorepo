/**
 * A change to read and review: one card per file (status, path, counts, collapse), hunks drawn
 * unified or split in one table whose rows sit in chunks the browser skips until they near the
 * screen, word-level marks, review threads between rows, and one island for the whole page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FileStatus, Hunk, WordRange } from "@sdxc/diff";
import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { ChevronDownIcon, CopyIcon, UnfoldVerticalIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, borderEdge, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { cursor, mergeMix, raw } from "@sdxc/u/general";
import { center, flexWrap, hstack, shrink, vstack } from "@sdxc/u/layout";
import { bs, is, minIs, p, pb, pi } from "@sdxc/u/size";
import { focusVisible, hover, when } from "@sdxc/u/state";
import { font, tabularNums, text, weight } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import type { CodeToken } from "../utils/code-lines.js";

import { panelChrome } from "../styles/panel-chrome.js";
import { segmentedItem, segmentedTrack } from "../styles/segmented-control.js";

import type { DiffInteractions as DiffGestures } from "./mixins/diff-interactions.js";
import type { DiffSide, SplitRow } from "./utils/diff-rows.js";

import { diffInteractions } from "./mixins/diff-interactions.js";
import { CODE_TOKEN_PALETTE, codeTokenRules } from "./styles/code-tokens.js";
import {
	changeBlocks,
	hunkHeader,
	hunkTokens,
	markRuns,
	pathHash,
	splitRows,
} from "./utils/diff-rows.js";

export type { DiffSide } from "./utils/diff-rows.js";
export { DIFF_COMMENT_EVENT } from "./mixins/diff-interactions.js";
export { changeBlocks, hunkHeader, splitRows } from "./utils/diff-rows.js";

/**
 * Lines per `<tbody>` chunk. Each chunk is skipped by `content-visibility` until it nears the
 * screen, so a long diff lays out only what is read, while find-in-page and line anchors still
 * reach every line because every line is in the document.
 */
const DEFAULT_CHUNK_SIZE = 200;

/** Changed lines past which a file renders collapsed, behind the app's "Load diff". */
const DEFAULT_LARGE_THRESHOLD = 400;

/** Height of one unwrapped line, which a skipped chunk reserves per line. */
const LINE_HEIGHT = "var(--diff-line-height, 1.25rem)";

/** Container width below which unified lines wrap instead of scrolling sideways. */
const WRAP_WIDTH = "40rem";

/** Container width below which the split view lays its rows out as unified ones. */
const SPLIT_WIDTH = "48rem";

/** Selector for a cell of a line row, which leaves out the full-width hunk and thread cells. */
const LINE_CELL = "td:not([colspan])";

/** The letter each file status draws, the shape that tells statuses apart beside their tone. */
const STATUS_LETTERS: Record<FileStatus, string> = {
	added: "A",
	modified: "M",
	deleted: "D",
	renamed: "R",
	copied: "C",
};

/** The semantic tone each file status paints its letter in. */
const STATUS_TONES: Record<FileStatus, string> = {
	added: "success",
	modified: "warning",
	deleted: "danger",
	renamed: "brand",
	copied: "brand",
};

/**
 * Prop types for {@link Diff} and its parts.
 */
export namespace Diff {
	/** How hunks draw: one column of lines, or the old and new sides beside each other. */
	export type View = "unified" | "split";

	/** Every string the page's island announces. */
	export interface Labels {
		/** Announced once a path is on the clipboard, such as "Copied". */
		copied: string;
	}

	/** Props accepted by {@link Diff}: every native `<div>` attribute for its root. */
	export interface Props extends TagProps<"div"> {
		/** The strings the page's island announces, so it reads in any language. */
		labels: Labels;
		/** A {@link Diff.Toolbar} and the page's {@link Diff.File} cards. */
		children?: RemixNode;
	}

	/** Copy {@link Diff.Toolbar} shows. */
	export interface ToolbarLabels {
		/** Names the view switch for assistive technology, such as "Diff view". */
		view: string;
		/** The unified link's text, such as "Unified". */
		unified: string;
		/** The split link's text, such as "Split". */
		split: string;
		/** Follows the "n / N" count, such as "files viewed". */
		filesViewed: string;
	}

	/** Props accepted by {@link Diff.Toolbar}: every native `<div>` attribute. */
	export interface ToolbarProps extends TagProps<"div"> {
		/** The view the page renders, which the switch marks current. */
		view: View;
		/** This page's address with `?diff=unified`. */
		unifiedHref: string;
		/** This page's address with `?diff=split`. */
		splitHref: string;
		/** The frame the view links swap, such as `"main"`. */
		target?: string;
		/** Files marked viewed; with `total`, draws "n / N files viewed" and its bar. */
		viewed?: number;
		/** The files on the page; with `viewed`, draws the progress. */
		total?: number;
		/** The toolbar's strings. */
		labels: ToolbarLabels;
		/** Controls between the switch and the progress: "Jump to", a file filter. */
		children?: RemixNode;
	}

	/** The hidden column headers a screen reader announces for each cell. */
	export interface ColumnLabels {
		/** Such as "Original file line number". */
		oldNumber: string;
		/** Such as "Diff line number". */
		newNumber: string;
		/** The old side's code in the split view, such as "Original file line". */
		oldText: string;
		/** Such as "Diff line change". */
		change: string;
	}

	/** Copy {@link Diff.Hunks} shows or announces. */
	export interface HunksLabels {
		/** The hidden headers that tell a screen reader which column a cell is in. */
		columns: ColumnLabels;
		/** Names each hunk's expand link, such as "Expand context". */
		expandContext?: string;
		/** Names a line's `+` link, such as `(side, line) => \`Comment on line ${side}${line}\``. */
		addComment?: (side: DiffSide, line: number) => string;
	}

	/** Copy {@link Diff.File} shows or announces. */
	export interface FileLabels extends HunksLabels {
		/** Names the copy button, such as "Copy file path". */
		copyPath: string;
		/** Read for each status letter, such as `{ modified: "Modified", … }`. */
		statuses: Record<FileStatus, string>;
		/** Read for the counts, such as `(added, deleted) => \`${added} additions, ${deleted} deletions\``. */
		changes: (additions: number, deletions: number) => string;
		/** Such as "Binary file not shown." */
		binary: string;
		/** Shown when the patch was dropped for size, such as "Large diff not shown." */
		tooLarge: string;
		/** Shown above the `load` slot, such as "Large diffs are not rendered by default." */
		largeDiff: string;
		/** Shown for a file whose change has no lines, such as "File renamed without changes." */
		empty?: string;
	}

	/** What {@link Diff.Hunks} draws and how its lines link. */
	export interface HunksProps extends TagProps<"div"> {
		/** The file's path, which names the table and keys the comment links. */
		path: string;
		/** The parsed hunks to draw, with their word-level ranges. */
		hunks: readonly Hunk[];
		/** Language the code highlights as (`ts`, `css`); omitted, lines draw plain. */
		language?: string;
		/** One column, or old and new side by side above 48rem. @default "unified" */
		view?: View;
		/** Prefix of every line anchor, `<fileId>R12`. @default "diff-" plus a hash of the path */
		fileId?: string;
		/**
		 * Review threads drawn as a full-width row after their line, keyed `R12` (new side)
		 * or `L12` (old side).
		 */
		threads?: Readonly<Record<string, RemixNode>>;
		/** The address a line's number links to. @default `#<fileId><side><line>` */
		lineHref?: (side: DiffSide, line: number) => string;
		/** Where a line's `+` goes without script; set, every line draws a `+`. */
		commentHref?: (path: string, side: DiffSide, line: number) => string;
		/** Where a hunk's expand link goes, which the app can answer as a frame. */
		expandHref?: (hunk: Hunk, index: number) => string;
		/** Lines per chunk. @default DEFAULT_CHUNK_SIZE */
		chunkSize?: number;
		/**
		 * Gives each number an `id` and a link. Turn it off for a copy of lines shown beside
		 * the file itself (a thread's excerpt or suggestion), so anchors stay unique. @default true
		 */
		anchored?: boolean;
		/** The table's strings. */
		labels: HunksLabels;
	}

	/** Props accepted by {@link Diff.File}: every native `<section>` attribute, plus the file. */
	export interface FileProps
		extends
			Omit<TagProps<"section">, "children">,
			Omit<HunksProps, keyof TagProps<"div"> | "hunks" | "labels" | "fileId" | "anchored"> {
		/** The path on the old side, drawn as `old → new` when it differs from `path`. */
		oldPath?: string;
		/** Drawn as a toned letter (A, M, D, R, C) and read out through `labels.statuses`. */
		status: FileStatus;
		/** Lines added, counted in the header and its five-block bar. */
		additions: number;
		/** Lines deleted, counted in the header and its five-block bar. */
		deletions: number;
		/** The file's hunks; omitted for a binary file, a dropped patch or a lazy one. */
		hunks?: readonly Hunk[];
		/** Git declared the file binary. */
		binary?: boolean;
		/** The patch was dropped for size, so the file draws "Large diff not shown". */
		tooLarge?: boolean;
		/** Renders closed, as a reader's collapse would. */
		collapsed?: boolean;
		/** The reader marked the file viewed, which renders it closed. */
		viewed?: boolean;
		/** The "Viewed" checkbox, as a form that posts the mark (an `OptimisticToggle`). */
		viewedControl?: RemixNode;
		/** A `⋯` menu trigger at the header's end. */
		menu?: RemixNode;
		/**
		 * What a large file shows in place of its lines, such as a lazy frame's "Load diff";
		 * given, a file past `largeThreshold` renders collapsed and draws no row.
		 */
		load?: RemixNode;
		/** Changed lines past which the file counts as large. @default DEFAULT_LARGE_THRESHOLD */
		largeThreshold?: number;
		/** The card's strings, so it reads in any language. */
		labels: FileLabels;
	}

	/** What a `DiffCommentEvent` names: the file, the side and the lines, counted from 1. */
	export type CommentDetail = DiffGestures.CommentDetail;

	/** Props {@link DiffInteractions} receives from {@link Diff}. */
	export interface InteractionsProps {
		/** The root's strings. */
		labels: Labels;
	}
}

/**
 * Without script each `+` links to `commentHref`; mapping `@sdxc/ui/app/diff` runs one
 * {@link DiffInteractions} for every file, turning `+`, drags and copy into `DIFF_COMMENT_EVENT`.
 * Set `--diff-font-size`, `--diff-line-height` and the `--diff-add-*`/`--diff-del-*` tints.
 *
 * @param handle Runtime handle carrying the root's props.
 * @returns The render function producing the root.
 * @example
 * <Diff labels={{ copied: t("copied") }}>
 * 	<Diff.Toolbar view={view} unifiedHref="?diff=unified" splitHref="?diff=split" viewed={2} total={files.length} labels={toolbarLabels} />
 * 	{files.map((file) => <Diff.File path={file.newPath} oldPath={file.oldPath} status={file.status} additions={file.additions} deletions={file.deletions} hunks={parseHunks(text, file)} language="ts" view={view} labels={fileLabels} />)}
 * </Diff>
 */
export function Diff(handle: Handle<Diff.Props>) {
	return () => {
		let { children, labels, mix, ...rest } = handle.props;
		return (
			<div {...rest} data-slot="diff" mix={mergeMix([vstack({ gap: 4 }), minIs(0)], mix)}>
				{children}
				<DiffInteractions labels={labels} />
			</div>
		);
	};
}

/**
 * Client island every {@link Diff} renders once: a status region the `diffInteractions()`
 * mixin speaks through, which listens on the whole root for line gestures and copy buttons.
 * Loads from `@sdxc/ui/app/diff#DiffInteractions` once the app's browser entry maps it.
 */
export const DiffInteractions: EntryComponent<Diff.InteractionsProps> = clientEntry(
	"@sdxc/ui/app/diff#DiffInteractions",
	function DiffInteractions(handle: Handle<Diff.InteractionsProps>) {
		return () => (
			<span
				role="status"
				data-slot="diff-status"
				mix={[visuallyHidden(), diffInteractions({ copied: handle.props.labels.copied })]}
			/>
		);
	},
);

/**
 * Renders the bar above the files: the unified/split switch as two GET links carried in the
 * address, the app's own controls, then "n / N files viewed" with a bar that fills as the
 * review burns down.
 *
 * @param handle Runtime handle carrying the toolbar's props.
 * @returns The render function producing the toolbar.
 * @example <Diff.Toolbar view="split" unifiedHref="?diff=unified" splitHref="?diff=split" target="main" viewed={3} total={12} labels={{ view: "Diff view", unified: "Unified", split: "Split", filesViewed: "files viewed" }} />
 */
Diff.Toolbar = function DiffToolbar(handle: Handle<Diff.ToolbarProps>) {
	return () => {
		let { children, labels, mix, splitHref, target, total, unifiedHref, view, viewed, ...rest } =
			handle.props;
		let views: [Diff.View, string, string][] = [
			["unified", unifiedHref, labels.unified],
			["split", splitHref, labels.split],
		];
		return (
			<div
				{...rest}
				data-slot="diff-toolbar"
				mix={mergeMix(
					[hstack({ gap: 3, align: "center", justify: "between" }), flexWrap("wrap"), text("sm")],
					mix,
				)}
			>
				<nav aria-label={labels.view} mix={[segmentedTrack(), hstack({ align: "center" })]}>
					{views.map(([name, href, label]) => (
						<a
							href={href}
							data-rmx-target={target}
							aria-current={name === view ? "page" : undefined}
							mix={[
								hstack({ align: "center" }),
								bs(7),
								pi(2.5),
								segmentedItem({ selected: '&[aria-current="page"]' }),
								raw({ textDecoration: "none" }),
							]}
						>
							{label}
						</a>
					))}
				</nav>
				{children}
				{total === undefined ? null : (
					<span
						data-slot="diff-progress"
						mix={[hstack({ gap: 2, align: "center" }), fg("neutral.muted"), tabularNums()]}
					>
						<span>{`${viewed ?? 0} / ${total} ${labels.filesViewed}`}</span>
						<progress
							value={viewed ?? 0}
							max={Math.max(total, 1)}
							aria-label={labels.filesViewed}
							mix={[
								is(16),
								bs(1.5),
								raw({
									appearance: "none",
									border: "none",
									borderRadius: "999px",
									overflow: "hidden",
									backgroundColor: "var(--ui-neutral-bg-tint, var(--ui-neutral-border))",
									"&::-webkit-progress-bar": { backgroundColor: "transparent" },
									"&::-webkit-progress-value": { backgroundColor: "var(--ui-success-fg)" },
									"&::-moz-progress-bar": { backgroundColor: "var(--ui-success-fg)" },
								}),
							]}
						/>
					</span>
				)}
			</div>
		);
	};
};

/**
 * Renders one file's card: a `<details>` whose summary carries the chevron, status, path,
 * counts and five-block bar, with copy, `⋯` and "Viewed" beside it, then the lines or the note
 * standing in for them. A collapsed, viewed or large file renders closed, like a checklist.
 *
 * @param handle Runtime handle carrying the card's props.
 * @returns The render function producing the card.
 * @example
 * <Diff.File path="app/routes.ts" status="modified" additions={12} deletions={3} hunks={hunks} language="ts" view="split"
 * 	viewed={viewedPaths.has("app/routes.ts")} viewedControl={<OptimisticToggle … />} threads={{ R14: <ReviewThread … /> }}
 * 	commentHref={(path, side, line) => `?comment=${path}:${side}${line}`} labels={labels} />
 * @example <Diff.File path="dist/app.js" status="modified" additions={9000} deletions={8800} load={<LazyFrame src={`/diff/${sha}/dist/app.js`} />} labels={labels} />
 */
Diff.File = function DiffFile(handle: Handle<Diff.FileProps>) {
	return () => {
		let {
			additions,
			binary,
			chunkSize,
			collapsed,
			commentHref,
			deletions,
			expandHref,
			hunks,
			id,
			labels,
			language,
			largeThreshold = DEFAULT_LARGE_THRESHOLD,
			lineHref,
			load,
			menu,
			mix,
			oldPath,
			path,
			status,
			threads,
			tooLarge,
			view,
			viewed,
			viewedControl,
			...rest
		} = handle.props;
		let fileId = id ?? `diff-${pathHash(path)}`;
		let large = load !== undefined && additions + deletions > largeThreshold;
		let open = !(collapsed || viewed || large);
		let moved = oldPath !== undefined && oldPath !== path;

		return (
			<section
				{...rest}
				id={fileId}
				data-slot="diff-file"
				data-path={path}
				data-status={status}
				data-viewed={viewed ? "" : undefined}
				data-large={large ? "" : undefined}
				mix={mergeMix(
					[
						panelChrome(),
						minIs(0),
						raw({
							display: "grid",
							gridTemplateColumns: "minmax(0, 1fr) auto",
							gridTemplateRows: "auto auto",
							overflow: "clip",
							backgroundColor: "var(--diff-bg)",
							"--diff-bg": "var(--ui-surface-raised, var(--ui-bg, Canvas))",
						}),
					],
					mix,
				)}
			>
				<details
					open={open}
					data-slot="diff-file-details"
					mix={[
						raw({
							gridColumn: "1 / -1",
							gridRow: "1 / -1",
							display: "grid",
							gridTemplateColumns: "subgrid",
							gridTemplateRows: "subgrid",
							minInlineSize: 0,
							"&::details-content": { gridColumn: "1 / -1", gridRow: 2, minInlineSize: 0 },
						}),
					]}
				>
					<summary
						data-slot="diff-file-header"
						mix={[
							hstack({ gap: 2, align: "center" }),
							flexWrap("wrap"),
							minIs(0),
							pi(3),
							pb(2),
							bg("neutral.bg-tint"),
							cursor("pointer"),
							text("sm"),
							raw({
								gridColumn: 1,
								gridRow: 1,
								minBlockSize: "2.75rem",
								listStyle: "none",
								"&::-webkit-details-marker": { display: "none" },
							}),
							focusVisible(outline({ color: "brand.ring", offset: -2 })),
						]}
					>
						<ChevronDownIcon
							size={16}
							aria-hidden="true"
							mix={[
								shrink(0),
								fg("neutral.muted"),
								raw({ rotate: "-90deg", transition: "rotate 150ms ease" }),
								when(":is(details[open] > summary) > &", raw({ rotate: "0deg" })),
							]}
						/>
						<span
							data-slot="diff-file-status"
							aria-hidden="true"
							mix={[
								center(),
								shrink(0),
								is(4),
								bs(4),
								rounded("sm"),
								raw({ border: "1px solid currentColor", fontSize: "0.625rem", lineHeight: 1 }),
								fg(STATUS_TONES[status]),
								weight(600),
							]}
						>
							{STATUS_LETTERS[status]}
						</span>
						<span mix={[visuallyHidden()]}>{labels.statuses[status]}</span>
						<span
							data-slot="diff-file-path"
							mix={[
								minIs(0),
								font("mono"),
								text("xs"),
								weight(600),
								fg("neutral.emphasis"),
								raw({ overflowWrap: "anywhere" }),
							]}
						>
							{moved ? `${oldPath} → ${path}` : path}
						</span>
						<span
							data-slot="diff-file-counts"
							mix={[hstack({ gap: 1.5, align: "center" }), text("xs"), tabularNums()]}
						>
							<span mix={[visuallyHidden()]}>{labels.changes(additions, deletions)}</span>
							<span aria-hidden="true" mix={[fg("success")]}>{`+${additions}`}</span>
							<span aria-hidden="true" mix={[fg("danger")]}>{`−${deletions}`}</span>
							<span
								data-slot="diff-file-bar"
								aria-hidden="true"
								mix={[
									hstack({ gap: 0.5 }),
									raw({
										"& > span": {
											inlineSize: "0.5rem",
											blockSize: "0.5rem",
											borderRadius: "1px",
											backgroundColor: "var(--ui-neutral-border)",
										},
										"& > [data-block='add']": { backgroundColor: "var(--ui-success-fg)" },
										"& > [data-block='del']": { backgroundColor: "var(--ui-danger-fg)" },
									}),
								]}
							>
								{changeBlocks(additions, deletions).map((block) => (
									<span data-block={block} />
								))}
							</span>
						</span>
					</summary>
					<div
						data-slot="diff-file-body"
						mix={[borderEdge("block-start", { color: "neutral.border", width: 1, style: "solid" })]}
					>
						{fileBody({
							additions,
							binary,
							chunkSize,
							commentHref,
							deletions,
							expandHref,
							fileId,
							hunks,
							labels,
							language,
							large,
							lineHref,
							load,
							path,
							threads,
							tooLarge,
							view,
						})}
					</div>
				</details>
				<div
					data-slot="diff-file-actions"
					mix={[
						hstack({ gap: 1, align: "center" }),
						pi(2),
						bg("neutral.bg-tint"),
						text("xs"),
						raw({ gridColumn: 2, gridRow: 1, alignSelf: "stretch" }),
					]}
				>
					<button
						type="button"
						data-action="copy-path"
						data-path={path}
						aria-label={labels.copyPath}
						title={labels.copyPath}
						mix={[
							center(),
							is(7),
							bs(7),
							rounded("sm"),
							fg("neutral.muted"),
							raw({
								display: "none",
								border: "none",
								background: "none",
								padding: 0,
								cursor: "pointer",
							}),
							when("[data-diff-live] &", raw({ display: "inline-flex" })),
							hover(bg("neutral.bg-tint-hover")),
							when("&[data-copied]", fg("success")),
							focusVisible(outline({ color: "brand.ring", offset: 2 })),
						]}
					>
						<CopyIcon size={14} aria-hidden="true" />
					</button>
					{menu}
					{viewedControl}
				</div>
			</section>
		);
	};
};

/** What {@link fileBody} needs from a {@link Diff.File}'s props. */
interface FileBodyInput extends Omit<
	Diff.HunksProps,
	keyof TagProps<"div"> | "hunks" | "labels" | "anchored"
> {
	additions: number;
	deletions: number;
	binary?: boolean;
	tooLarge?: boolean;
	large: boolean;
	load?: RemixNode;
	hunks?: readonly Hunk[];
	labels: Diff.FileLabels;
}

/**
 * The card's body, by cause: a binary file and a dropped patch say why there are no lines, a
 * large file shows the app's `load` slot, a change without lines says so, and anything else
 * draws its hunks.
 */
function fileBody(input: FileBodyInput): RemixNode {
	let { binary, hunks, labels, large, load, tooLarge } = input;
	let note = (message: RemixNode, slot?: RemixNode) => (
		<div
			data-slot="diff-file-note"
			mix={[
				vstack({ gap: 2, align: "center" }),
				p(4),
				text("sm"),
				fg("neutral.muted"),
				raw({ textAlign: "center" }),
			]}
		>
			<p mix={[raw({ margin: 0 })]}>{message}</p>
			{slot}
		</div>
	);
	if (binary) return note(labels.binary);
	if (tooLarge) return note(labels.tooLarge);
	if (large) return note(labels.largeDiff, load);
	if (!hunks || hunks.length === 0) return labels.empty ? note(labels.empty) : null;
	return (
		<Diff.Hunks
			path={input.path}
			hunks={hunks}
			language={input.language}
			view={input.view}
			fileId={input.fileId}
			threads={input.threads}
			lineHref={input.lineHref}
			commentHref={input.commentHref}
			expandHref={input.expandHref}
			chunkSize={input.chunkSize}
			labels={labels}
		/>
	);
}

/**
 * Renders hunks as one table without a card, for {@link Diff.File} and for a thread's excerpt
 * or suggestion. Split draws old and new side by side and, once its container is narrower
 * than 48rem, lays the same markup out as unified: two number columns, then the code.
 *
 * @param handle Runtime handle carrying the hunks' props.
 * @returns The render function producing the table.
 * @example <Diff.Hunks path="app/routes.ts" hunks={excerpt} language="ts" labels={{ columns }} />
 */
Diff.Hunks = function DiffHunks(handle: Handle<Diff.HunksProps>) {
	return () => {
		let {
			anchored = true,
			chunkSize = DEFAULT_CHUNK_SIZE,
			commentHref,
			expandHref,
			fileId,
			hunks,
			labels,
			language,
			lineHref,
			mix,
			path,
			threads,
			view = "unified",
			...rest
		} = handle.props;
		let anchor = fileId ?? `diff-${pathHash(path)}`;
		let scope: RowScope = {
			anchor,
			anchored,
			path,
			view,
			columns: view === "split" ? 4 : 3,
			lineHref: lineHref ?? ((side, line) => `#${anchor}${side}${line}`),
			commentHref,
			threads,
			expandHref,
			labels,
		};
		let widest = 1;
		for (let hunk of hunks) {
			widest = Math.max(widest, hunk.oldStart + hunk.oldLines, hunk.newStart + hunk.newLines);
		}
		let digits = Math.max(2, String(widest).length);
		let entries = hunks.flatMap((hunk, index) => hunkEntries(hunk, index, language, scope));
		let quote =
			view === "unified" &&
			threads === undefined &&
			hunks.every((hunk) =>
				hunk.lines.every((line) => line.kind === "context" && line.old === line.new),
			);

		return (
			<div
				{...rest}
				data-slot="diff-hunks"
				data-view={view}
				mix={mergeMix(
					[
						minIs(0),
						raw({
							container: "diff / inline-size",
							"--diff-bg": "var(--ui-surface-raised, var(--ui-bg, Canvas))",
							backgroundColor: "var(--diff-bg)",
						}),
					],
					mix,
				)}
			>
				<div
					data-slot="diff-scroll"
					dir="ltr"
					mix={[raw({ overflowX: "auto", overscrollBehaviorInline: "contain" })]}
				>
					<table aria-label={path} mix={[tableRules(view, digits, quote)]}>
						<thead>
							<tr>
								<th scope="col">{labels.columns.oldNumber}</th>
								{view === "split" ? <th scope="col">{labels.columns.oldText}</th> : null}
								<th scope="col">{labels.columns.newNumber}</th>
								<th scope="col">{labels.columns.change}</th>
							</tr>
						</thead>
						{chunks(entries, chunkSize).map((chunk) => (
							<tbody
								mix={[
									raw({
										containIntrinsicBlockSize: `auto calc(${chunk.lines} * ${LINE_HEIGHT})`,
									}),
								]}
							>
								{chunk.rows}
							</tbody>
						))}
					</table>
				</div>
			</div>
		);
	};
};

/** The nested rules `raw()` takes, so rule sets built in pieces keep their checking. */
type RawStyles = Parameters<typeof raw>[0];

/** What every row builder reads about the table it draws into. */
interface RowScope {
	/** Prefix of every line anchor. */
	anchor: string;
	/** Numbers carry ids and links. */
	anchored: boolean;
	path: string;
	view: Diff.View;
	/** Cells a full-width row spans. */
	columns: number;
	lineHref: (side: DiffSide, line: number) => string;
	commentHref?: (path: string, side: DiffSide, line: number) => string;
	threads?: Readonly<Record<string, RemixNode>>;
	expandHref?: (hunk: Hunk, index: number) => string;
	labels: Diff.HunksLabels;
}

/** A row ready to draw and the lines it counts toward its chunk. */
interface Entry {
	row: RemixNode;
	lines: number;
}

/** A chunk's rows and the lines they hold, which size the chunk before it lays out. */
interface Chunk {
	rows: RemixNode[];
	lines: number;
}

/**
 * Groups rows into chunks of about `size` lines; a chunk ends only after a whole row, so a
 * thread stays with its line.
 */
function chunks(entries: Entry[], size: number): Chunk[] {
	let result: Chunk[] = [];
	let current: Chunk = { rows: [], lines: 0 };
	for (let entry of entries) {
		current.rows.push(entry.row);
		current.lines += entry.lines;
		if (current.lines >= size) {
			result.push(current);
			current = { rows: [], lines: 0 };
		}
	}
	if (current.rows.length > 0) result.push(current);
	return result;
}

/**
 * One hunk's rows: its header (with the expand link), then its lines as the view draws them,
 * each followed by the threads keyed to it. Rows are plain local render values built in one
 * loop, since a diff can hold tens of thousands of them, with no component instance per row.
 */
function hunkEntries(
	hunk: Hunk,
	index: number,
	language: string | undefined,
	scope: RowScope,
): Entry[] {
	let runs = hunkTokens(hunk, language);
	let entries: Entry[] = [
		{
			lines: 1,
			row: (
				<tr data-hunk="">
					<td colSpan={scope.columns}>
						{scope.expandHref ? (
							<a
								href={scope.expandHref(hunk, index)}
								data-slot="diff-expand"
								aria-label={scope.labels.expandContext}
								title={scope.labels.expandContext}
							>
								<UnfoldVerticalIcon size={14} aria-hidden="true" />
							</a>
						) : null}
						{hunkHeader(hunk)}
					</td>
				</tr>
			),
		},
	];
	let thread = (side: DiffSide, line: number | undefined) => {
		let node = line === undefined ? undefined : scope.threads?.[`${side}${line}`];
		if (node === undefined) return;
		entries.push({
			lines: 2,
			row: (
				<tr data-thread="">
					<td colSpan={scope.columns}>{node}</td>
				</tr>
			),
		});
	};

	if (scope.view === "split") {
		for (let pair of splitRows(hunk.lines)) {
			entries.push({ lines: 1, row: splitRow(hunk, pair, runs, scope) });
			let oldLine = pair.old === undefined ? undefined : hunk.lines[pair.old];
			let newLine = pair.new === undefined ? undefined : hunk.lines[pair.new];
			if (oldLine?.kind === "del") thread("L", oldLine.old);
			thread("R", newLine?.new);
		}
		return entries;
	}

	for (let [position, line] of hunk.lines.entries()) {
		let side: DiffSide = line.kind === "del" ? "L" : "R";
		let number = side === "L" ? line.old : line.new;
		entries.push({
			lines: 1,
			row: (
				<tr data-kind={line.kind === "context" ? undefined : line.kind}>
					{numberCell(scope, "L", line.old)}
					{numberCell(scope, "R", line.new)}
					{codeCell(scope, side, number, runs[position] ?? [], line.words)}
				</tr>
			),
		});
		if (line.kind !== "add") thread("L", line.old);
		thread("R", line.new);
	}
	return entries;
}

/**
 * One split row: the old side's number and code, then the new side's. A side with no line in
 * the pair draws two filler cells, which the narrow layout hides.
 */
function splitRow(hunk: Hunk, pair: SplitRow, runs: CodeToken[][], scope: RowScope): RemixNode {
	let oldLine = pair.old === undefined ? undefined : hunk.lines[pair.old];
	let newLine = pair.new === undefined ? undefined : hunk.lines[pair.new];
	let filler = [<td data-filler="" />, <td data-filler="" />];
	return (
		<tr
			data-old={oldLine?.kind === "del" ? "del" : undefined}
			data-new={newLine?.kind === "add" ? "add" : undefined}
		>
			{oldLine
				? [
						numberCell(scope, "L", oldLine.old),
						codeCell(scope, "L", oldLine.old, runs[pair.old!] ?? [], oldLine.words),
					]
				: filler}
			{newLine
				? [
						numberCell(scope, "R", newLine.new),
						codeCell(scope, "R", newLine.new, runs[pair.new!] ?? [], newLine.words),
					]
				: filler}
		</tr>
	);
}

/** A number cell: an empty link painted from `data-line-number`, so a copy takes only code. */
function numberCell(scope: RowScope, side: DiffSide, line: number | undefined): RemixNode {
	if (line === undefined) return <td />;
	if (!scope.anchored) {
		return (
			<td>
				<span data-line-number={line} />
			</td>
		);
	}
	return (
		<td>
			<a
				id={`${scope.anchor}${side}${line}`}
				href={scope.lineHref(side, line)}
				data-line-number={line}
			/>
		</td>
	);
}

/**
 * A code cell: the `+` link that starts a comment on the line (when the table takes
 * comments), then its runs with changed words in `<mark>`s. The sign is painted by the
 * table's rules from the row's kind.
 */
function codeCell(
	scope: RowScope,
	side: DiffSide,
	line: number | undefined,
	runs: readonly CodeToken[],
	words: readonly WordRange[] | undefined,
): RemixNode {
	let comment =
		scope.commentHref && line !== undefined ? (
			<a
				href={scope.commentHref(scope.path, side, line)}
				data-comment={`${side}${line}`}
				aria-label={scope.labels.addComment?.(side, line)}
			/>
		) : null;
	return (
		<td>
			{comment}
			{codeNodes(runs, words)}
		</td>
	);
}

/**
 * A line's runs as nodes: plain text stays a text node, a highlighted run is one
 * `span.token.<type>`, and a changed span wraps its runs in one `<mark>`.
 */
function codeNodes(
	runs: readonly CodeToken[],
	words: readonly WordRange[] | undefined,
): RemixNode[] {
	let nodes: RemixNode[] = [];
	let marked: RemixNode[] | undefined;
	for (let piece of markRuns(normalize(runs), words)) {
		let node =
			piece.type === "plain" ? (
				piece.value
			) : (
				<span className={`token ${piece.type}`}>{piece.value}</span>
			);
		if (piece.marked) {
			if (marked === undefined) {
				marked = [];
				nodes.push(<mark>{marked}</mark>);
			}
			marked.push(node);
		} else {
			marked = undefined;
			nodes.push(node);
		}
	}
	return nodes;
}

/** Turns runs of a type the palette does not paint into plain runs, so they merge as text. */
function normalize(runs: readonly CodeToken[]): CodeToken[] {
	return runs.map((run) =>
		CODE_TOKEN_PALETTE[run.type] ? run : { type: "plain", value: run.value },
	);
}

/**
 * Every rule the table and its rows follow, set once on the table so no row carries a class of
 * its own. Chunks lay their rows out on one grid of fixed tracks, so columns line up across
 * chunks while each chunk can be skipped on its own; row kinds color cells and paint signs.
 *
 * @param view Which layout the rows follow.
 * @param digits Digits the widest line number needs.
 * @param quote Whether every line is unchanged at the same number, which draws one number column.
 */
function tableRules(view: Diff.View, digits: number, quote = false) {
	let numberWidth = `calc(${digits}ch + 1.25rem)`;
	let numbers = quote ? numberWidth : `${numberWidth} ${numberWidth}`;
	let mixWith = (tone: string, amount: number, fallback: string) =>
		`var(${fallback}, color-mix(in oklab, var(--ui-${tone}-fg) ${amount}%, var(--diff-bg)))`;
	let add = mixWith("success", 12, "--diff-add-bg");
	let addNumber = mixWith("success", 22, "--diff-add-number-bg");
	let addWord = mixWith("success", 34, "--diff-add-word-bg");
	let del = mixWith("danger", 10, "--diff-del-bg");
	let delNumber = mixWith("danger", 20, "--diff-del-number-bg");
	let delWord = mixWith("danger", 30, "--diff-del-word-bg");
	let band = mixWith("brand", 16, "--diff-selected-bg");
	let shared: RawStyles = {
		margin: 0,
		borderCollapse: "collapse",
		fontFamily: "var(--ui-font-mono, ui-monospace, monospace)",
		fontVariantLigatures: "none",
		fontSize: "var(--diff-font-size, 0.75rem)",
		lineHeight: LINE_HEIGHT,
		color: "var(--ui-neutral-fg-emphasis)",
		tabSize: 4,
		"& > thead": {
			position: "absolute",
			inlineSize: "1px",
			blockSize: "1px",
			overflow: "hidden",
			clipPath: "inset(50%)",
			whiteSpace: "nowrap",
		},
		"& > tbody > tr": { display: "contents" },
		"& > tbody > tr > td": { padding: 0, verticalAlign: "top" },
		[`& > tbody > tr > ${LINE_CELL}`]: { backgroundColor: "var(--diff-bg)" },
		"& > tbody > tr > td[colspan]": {
			gridColumn: "1 / -1",
			position: "sticky",
			insetInlineStart: 0,
			maxInlineSize: "100cqi",
			boxSizing: "border-box",
		},
		"& > tbody > tr[data-hunk] > td": {
			display: "flex",
			alignItems: "center",
			gap: "0.5rem",
			paddingInline: "0.75rem",
			paddingBlock: "0.25rem",
			backgroundColor: mixWith("brand", 8, "--diff-hunk-bg"),
			color: "var(--ui-neutral-fg-muted)",
			whiteSpace: "pre",
			overflow: "hidden",
			textOverflow: "ellipsis",
		},
		"& > tbody > tr > td > [data-slot='diff-expand']": {
			display: "inline-flex",
			color: "inherit",
			borderRadius: "var(--ui-radius-sm, 0.25rem)",
		},
		"& > tbody > tr > td > [data-slot='diff-expand']:hover": { color: "var(--ui-brand-fg)" },
		"& > tbody > tr[data-thread] > td": {
			paddingBlock: "0.5rem",
			paddingInline: "0.75rem",
			whiteSpace: "normal",
			fontFamily: "var(--ui-font-sans, system-ui, sans-serif)",
			fontSize: "0.875rem",
			lineHeight: 1.5,
			backgroundColor: "var(--diff-bg)",
			borderBlock: "1px solid var(--ui-neutral-border)",
		},
		"& > tbody > tr > td > [data-line-number]": {
			display: "block",
			paddingInline: "0.5rem",
			textAlign: "end",
			color: "var(--ui-neutral-fg-muted)",
			textDecoration: "none",
			cursor: "pointer",
			outline: "none",
			userSelect: "none",
		},
		"& > tbody > tr > td > [data-line-number]::before": { content: "attr(data-line-number)" },
		"& > tbody > tr > td > a[data-line-number]:hover": { color: "var(--ui-neutral-fg-emphasis)" },
		"& > tbody > tr > td > a[data-line-number]:focus-visible": {
			boxShadow: "inset 0 0 0 2px var(--ui-brand-ring, var(--ui-brand-fg))",
			borderRadius: "var(--ui-radius-sm, 0.25rem)",
		},
		"& > tbody > tr > td > a[data-comment]": {
			position: "absolute",
			insetInlineStart: "0.125rem",
			insetBlockStart: `calc((${LINE_HEIGHT} - 1.125rem) / 2)`,
			display: "grid",
			placeItems: "center",
			inlineSize: "1.125rem",
			blockSize: "1.125rem",
			borderRadius: "var(--ui-radius-sm, 0.25rem)",
			backgroundColor: "var(--ui-brand-bg-solid, var(--ui-brand-fg))",
			color: "var(--ui-brand-fg-on-solid, white)",
			fontFamily: "var(--ui-font-sans, system-ui, sans-serif)",
			fontWeight: 600,
			fontSize: "0.875rem",
			lineHeight: 1,
			textDecoration: "none",
			opacity: 0,
			cursor: "pointer",
			userSelect: "none",
			zIndex: 1,
		},
		"& > tbody > tr > td > a[data-comment]::before": { content: '"+"' },
		"& > tbody > tr:hover > td > a[data-comment], & > tbody > tr:focus-within > td > a[data-comment], & > tbody > tr > td > a[data-comment]:focus-visible":
			{ opacity: 1 },
		"& > tbody > tr > td > a[data-comment]:focus-visible": {
			outline: "2px solid var(--ui-brand-ring, var(--ui-brand-fg))",
			outlineOffset: "1px",
		},
		"& > tbody > tr > td > mark": { color: "inherit", borderRadius: "2px" },
		...codeTokenRules(),
	};
	let selection: RawStyles = {
		[`& > tbody > tr[data-selected] > ${LINE_CELL}, & > tbody > tr:has(> td > a:target) > ${LINE_CELL}`]:
			{
				backgroundColor: band,
			},
	};

	if (view === "split") {
		return raw(
			Object.assign(
				{},
				shared,
				{
					display: "block",
					inlineSize: "100%",
					"& > tbody": {
						display: "grid",
						contentVisibility: "auto",
						gridTemplateColumns: `${numberWidth} minmax(0, 1fr) ${numberWidth} minmax(0, 1fr)`,
					},
					[`& > tbody > tr > ${LINE_CELL}:nth-child(2n)`]: codeCellRules("pre-wrap"),
					[`& > tbody > tr > ${LINE_CELL}:nth-child(3)`]: {
						borderInlineStart: "1px solid var(--ui-neutral-border)",
					},
					"& > tbody > tr > td[data-filler]": {
						backgroundColor: "var(--diff-filler-bg, var(--ui-neutral-bg-tint, var(--diff-bg)))",
					},
					[`& > tbody > tr[data-old] > ${LINE_CELL}:nth-child(-n+2)`]: { backgroundColor: del },
					[`& > tbody > tr[data-old] > ${LINE_CELL}:nth-child(1)`]: { backgroundColor: delNumber },
					"& > tbody > tr[data-old] > td:nth-child(2)::before": { content: '"-"' },
					"& > tbody > tr[data-old] > td:nth-child(2) mark": { backgroundColor: delWord },
					[`& > tbody > tr[data-new] > ${LINE_CELL}:nth-child(n+3)`]: { backgroundColor: add },
					[`& > tbody > tr[data-new] > ${LINE_CELL}:nth-child(3)`]: { backgroundColor: addNumber },
					"& > tbody > tr[data-new] > td:nth-child(4)::before": { content: '"+"' },
					"& > tbody > tr[data-new] > td:nth-child(4) mark": { backgroundColor: addWord },
					[`@container diff (max-width: ${SPLIT_WIDTH})`]: {
						"& > tbody": { gridTemplateColumns: `${numberWidth} ${numberWidth} minmax(0, 1fr)` },
						[`& > tbody > tr > ${LINE_CELL}:nth-child(1)`]: { gridColumn: 1 },
						[`& > tbody > tr > ${LINE_CELL}:nth-child(2)`]: { gridColumn: 3 },
						[`& > tbody > tr > ${LINE_CELL}:nth-child(3)`]: {
							gridColumn: 2,
							borderInlineStart: "none",
						},
						[`& > tbody > tr > ${LINE_CELL}:nth-child(4)`]: { gridColumn: 3 },
						"& > tbody > tr > td[data-filler]": { display: "none" },
						"& > tbody > tr[data-old] > td:nth-child(1)": { gridColumn: "1 / span 2" },
						"& > tbody > tr[data-old] > td:nth-child(1) > [data-line-number]": {
							inlineSize: "50%",
						},
						"& > tbody > tr[data-new] > td:nth-child(3)": { gridColumn: "1 / span 2" },
						"& > tbody > tr[data-new] > td:nth-child(3) > [data-line-number]": {
							marginInlineStart: "50%",
						},
						"& > tbody > tr:not([data-old], [data-new], [data-hunk], [data-thread]) > td:nth-child(2)":
							{
								display: "none",
							},
					},
				},
				selection,
			),
		);
	}

	return raw(
		Object.assign(
			{},
			shared,
			{
				display: "block",
				inlineSize: "max-content",
				minInlineSize: "100%",
				"& > tbody": {
					display: "grid",
					contentVisibility: "auto",
					gridTemplateColumns: `${numbers} 1fr`,
				},
				[`& > tbody > tr > ${LINE_CELL}:nth-child(-n+2)`]: { position: "sticky", zIndex: 1 },
				[`& > tbody > tr > ${LINE_CELL}:nth-child(1)`]: quote
					? { display: "none" }
					: { insetInlineStart: 0 },
				[`& > tbody > tr > ${LINE_CELL}:nth-child(2)`]: {
					insetInlineStart: quote ? 0 : numberWidth,
				},
				[`& > tbody > tr > ${LINE_CELL}:nth-child(3)`]: codeCellRules("pre"),
				[`& > tbody > tr[data-kind="add"] > ${LINE_CELL}`]: { backgroundColor: add },
				[`& > tbody > tr[data-kind="add"] > ${LINE_CELL}:nth-child(-n+2)`]: {
					backgroundColor: addNumber,
				},
				'& > tbody > tr[data-kind="add"] > td:nth-child(3)::before': { content: '"+"' },
				'& > tbody > tr[data-kind="add"] mark': { backgroundColor: addWord },
				[`& > tbody > tr[data-kind="del"] > ${LINE_CELL}`]: { backgroundColor: del },
				[`& > tbody > tr[data-kind="del"] > ${LINE_CELL}:nth-child(-n+2)`]: {
					backgroundColor: delNumber,
				},
				'& > tbody > tr[data-kind="del"] > td:nth-child(3)::before': { content: '"-"' },
				'& > tbody > tr[data-kind="del"] mark': { backgroundColor: delWord },
				[`@container diff (max-width: ${WRAP_WIDTH})`]: {
					"&": { inlineSize: "100%" },
					"& > tbody": { gridTemplateColumns: `${numbers} minmax(0, 1fr)` },
					[`& > tbody > tr > ${LINE_CELL}:nth-child(3)`]: {
						whiteSpace: "pre-wrap",
						overflowWrap: "anywhere",
						minInlineSize: 0,
					},
				},
			},
			selection,
		),
	);
}

/** A code cell: room on its start side for the sign and the `+`, and how its text wraps. */
function codeCellRules(whiteSpace: "pre" | "pre-wrap"): RawStyles {
	return {
		position: "relative",
		minInlineSize: 0,
		paddingInline: "1.5rem 1rem",
		whiteSpace,
		overflowWrap: whiteSpace === "pre" ? "normal" : "anywhere",
		"&::before": {
			position: "absolute",
			insetInlineStart: "0.5rem",
			color: "var(--ui-neutral-fg-muted)",
			userSelect: "none",
		},
	};
}
