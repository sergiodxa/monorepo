/**
 * A whole source file to read and cite: one table row per line, numbers painted from an
 * attribute so a copy takes only code, rows in chunks the browser skips until they near the
 * screen, a band for the cited lines, and blame hunks with an age strip beside them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps, RemixNode } from "remix/component";

import { tokenize } from "@sdxc/highlight";
import { EllipsisIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, borderEdge, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { mergeMix, raw } from "@sdxc/u/general";
import { center, flexWrap, hstack, relative, shrink } from "@sdxc/u/layout";
import { bs, is, minIs, pb, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { tabularNums, text } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import type { CodeToken } from "../utils/code-lines.js";
import type { RelativeTimeFormat } from "../utils/relative-time.js";

import { Menu } from "../components/menu.js";
import { panelChrome } from "../styles/panel-chrome.js";
import { codeLines } from "../utils/code-lines.js";
import { formatRelativeTime } from "../utils/relative-time.js";

import type { LineRange } from "./utils/line-range.js";

import { codeViewSelection } from "./mixins/code-view-selection.js";
import { CODE_TOKEN_PALETTE, codeTokenRules } from "./styles/code-tokens.js";
import { lineLink, lineRangeQuery } from "./utils/line-range.js";

export type { LineRange } from "./utils/line-range.js";
export { lineLink, lineRangeHash, lineRangeQuery, parseLineRange } from "./utils/line-range.js";

/**
 * Lines per `<tbody>` chunk. Each chunk is skipped by `content-visibility` until it nears
 * the screen, so a long file lays out only what is read, and find-in-page and `#L` anchors
 * still reach every line because every line is in the document.
 */
const DEFAULT_CHUNK_SIZE = 200;

/** Height of one unwrapped line, which a skipped chunk reserves per line. */
const LINE_HEIGHT = "var(--code-view-line-height, 1.25rem)";

/** Container width below which lines wrap and blame keeps only its age. */
const WRAP_WIDTH = "40rem";

/** Width of the blame column on a wide view. */
const BLAME_WIDTH = "var(--code-view-blame-width, 22rem)";

/** Width of the blame column once the view wraps. */
const BLAME_NARROW_WIDTH = "6.5rem";

/** Number of steps the age strip runs from oldest to newest. */
const AGE_STEPS = 5;

/** FNV-1a offset basis, the starting state of the hash that names a view from its path. */
const FNV_OFFSET = 0x811c9dc5;

/** FNV-1a prime, which spreads each character through the hash. */
const FNV_PRIME = 0x01000193;

/**
 * Prop types for {@link CodeView} and its parts.
 */
export namespace CodeView {
	/** One painted run of source; the runs `@sdxc/highlight` returns pass straight through. */
	export interface Token {
		/** The token's kind ("keyword", "string"), which picks its color from the highlight theme. */
		type: string;
		/** The source text the run covers; the runs joined give back the line. */
		value: string;
	}

	/** The commit a blame hunk names. */
	export interface BlameCommit {
		/** The commit's hash, shortened for display. */
		sha: string;
		/** The commit message's first line, the hunk's headline. */
		subject: string;
		/** Who made the commit, shown beside its age. */
		author: string;
		/** When the commit was made, which sets the hunk's age and its place on the strip. */
		date: RelativeTimeFormat.DateInput;
		/** Where the commit's page lives; the subject links there. */
		href: string;
	}

	/** A run of lines, counted from 1, last changed by one commit. */
	export interface BlameHunk {
		/** The hunk's first line. */
		start: number;
		/** The hunk's last line, inclusive. */
		end: number;
		/** The commit that last changed these lines. */
		commit: BlameCommit;
	}

	/** Every string the view shows or announces; the library ships no copy. */
	export interface Labels {
		/** Name of the button that opens the line menu, such as "Line options". */
		lineMenu: string;
		/** The line menu's item that copies the selected lines' text, such as "Copy line". */
		copyLine: string;
		/** The line menu's item that copies the cited lines' permalink, such as "Copy permalink". */
		copyPermalink: string;
		/** Shown when `issueHref` is set, such as "Reference in new issue". */
		referenceInNewIssue?: string;
		/** Announced once a line or a permalink is on the clipboard, such as "Copied". */
		copied: string;
		/** The help-sheet heading the view's keys list under. */
		group?: string;
		/** What `y` does in the help sheet, such as "Expand URL to its permalink". */
		permalinkKey?: string;
		/** What Escape does in the help sheet while lines are selected. */
		clearSelection?: string;
	}

	/**
	 * Props accepted by {@link CodeView}: every native `<div>` attribute for its root.
	 */
	export interface Props extends TagProps<"div"> {
		/** The file's source; a single trailing newline is dropped. */
		code: string;
		/** Language the code highlights as (`ts`, `css`); omitted, the code draws plain. */
		language?: string;
		/** The file's path, which names the table for assistive technology. */
		path: string;
		/** Runs already painted for `code`, which skip highlighting here. */
		tokens?: readonly Token[];
		/**
		 * The lines the page's address cites as `?L=3-8`, painted on the server so the band
		 * shows without script. Read it with `parseLineRange(url.searchParams.get("L"))`.
		 */
		selected?: LineRange;
		/** The address each line number links to. @default lineLink(line), `?L=n#Ln` */
		lineHref?: (line: number) => string;
		/** Blame hunks; when set, each hunk draws its commit and age in a leading column. */
		blame?: readonly BlameHunk[];
		/** The address of this file at a fixed commit, which `y` and "Copy permalink" use. */
		permalink?: string;
		/** Where "Reference in new issue" goes; the permalink arrives as its `body` parameter. */
		issueHref?: string;
		/** Every string the view shows or announces, so it reads in any language. */
		labels: Labels;
		/** The moment blame ages count from. @default the current time */
		now?: RelativeTimeFormat.DateInput;
		/** The locale blame ages are written in. @default the runtime's locale */
		locale?: string;
		/** Lines per chunk. @default DEFAULT_CHUNK_SIZE */
		chunkSize?: number;
		/** A {@link CodeView.Header} drawn above the lines. */
		children?: RemixNode;
	}

	/** Props accepted by {@link CodeView.Header}: every native `<div>` attribute. */
	export interface HeaderProps extends TagProps<"div"> {
		/** The file's facts, such as "49 lines (42 loc) · 1.75 KB", built from {@link codeStats}. */
		meta?: RemixNode;
		/** Actions at the header's end: Raw, Copy, Download, a Code | Blame switch. */
		children?: RemixNode;
	}

	/** Props accepted by {@link CodeView.AgeLegend}. */
	export interface AgeLegendProps extends TagProps<"div"> {
		/** The legend's ends, such as `{ older: "Older", newer: "Newer" }`. */
		labels: { older: string; newer: string };
	}

	/** Props {@link CodeViewSelection} receives from {@link CodeView}. */
	export interface SelectionProps {
		/** The `id` the line menu's popover takes. */
		menuId: string;
		/** The view's `permalink`, which `y` and "Copy permalink" extend with the selection. */
		permalink?: string;
		/** The view's `issueHref`, which shows "Reference in new issue" when set. */
		issueHref?: string;
		/** The view's strings. */
		labels: Labels;
	}
}

/** The facts a file header reads out, counted from the source. */
export interface CodeStats {
	/** Lines as the view numbers them. */
	lines: number;
	/** Lines holding anything other than whitespace. */
	loc: number;
	/** Size in bytes as UTF-8. */
	bytes: number;
}

/**
 * Counts a file the way its header reports it, dropping a single trailing newline as the
 * view does, so "49 lines" matches the last number drawn.
 *
 * @param code The file's source.
 * @returns Lines, lines of code and bytes, for the app to phrase in its own locale.
 * @example let { lines, loc, bytes } = codeStats(source); t("file.meta", { lines, loc, size: formatBytes(bytes) })
 */
export function codeStats(code: string): CodeStats {
	let lines = splitSource(code);
	return {
		lines: lines.length,
		loc: lines.filter((line) => line.trim() !== "").length,
		bytes: new TextEncoder().encode(code).length,
	};
}

/** The source's lines, without the empty one a trailing newline would add. */
function splitSource(code: string): string[] {
	return code.replace(/\r?\n$/, "").split(/\r?\n/);
}

/**
 * Without script `selected` and `#Ln` paint the cited lines, and each number links to `?L=n#Ln`;
 * mapping `@sdxc/ui/app/code-view` runs {@link CodeViewSelection} for ranges, the menu and `y`.
 * Set `--code-view-font-size`, `-line-height`, `-blame-width`, `-selected` and `--code-age-1`–`5`.
 *
 * @param handle Runtime handle carrying the view's props.
 * @returns The render function producing the view.
 * @example
 * <CodeView path="app/routes.ts" language="ts" code={source} selected={parseLineRange(url.searchParams.get("L"))} permalink={`/blob/${sha}/app/routes.ts`} labels={labels}>
 * 	<CodeView.Header meta={t("file.meta", codeStats(source))}>{actions}</CodeView.Header>
 * </CodeView>
 * @example
 * <CodeView path="app/routes.ts" language="ts" code={source} blame={hunks} labels={labels} />
 */
export function CodeView(handle: Handle<CodeView.Props>) {
	return () => {
		let {
			blame,
			children,
			chunkSize = DEFAULT_CHUNK_SIZE,
			code,
			id,
			issueHref,
			labels,
			language,
			lineHref = lineLink,
			locale,
			mix,
			now,
			path,
			permalink,
			selected,
			tokens,
			...rest
		} = handle.props;

		let source = code.replace(/\r?\n$/, "");
		let runs: readonly CodeToken[] =
			tokens ?? (language ? tokenize(source, language) : [{ type: "plain", value: source }]);
		let lines = codeLines(runs);
		let count = splitSource(code).length;
		while (lines.length < count) lines.push([]);
		lines.length = count;

		let viewId = id ?? stableId(path);
		let digits = Math.max(2, String(count).length);
		let blameCells =
			blame && blame.length > 0
				? blameSegments(blame, count, chunkSize, { now, locale })
				: undefined;
		let hasBlame = blameCells !== undefined;

		return (
			<div
				{...rest}
				id={viewId}
				data-slot="code-view"
				data-language={language}
				data-selection={selected ? lineRangeQuery(selected) : undefined}
				mix={mergeMix(
					[
						panelChrome(),
						relative(),
						minIs(0),
						raw({
							container: "code-view / inline-size",
							overflow: "clip",
							backgroundColor: "var(--code-view-bg)",
							"--code-view-bg": "var(--ui-surface-raised, var(--ui-bg, Canvas))",
						}),
					],
					mix,
				)}
			>
				{children}
				<div
					data-slot="code-view-scroll"
					dir="ltr"
					mix={[raw({ overflowX: "auto", overscrollBehaviorInline: "contain" })]}
				>
					<table aria-label={path} mix={[tableRules(digits, hasBlame)]}>
						{chunkRanges(count, chunkSize).map(({ start, end }) => (
							<tbody
								data-chunk={start}
								mix={[
									raw({
										containIntrinsicBlockSize: `auto calc(${end - start + 1} * ${LINE_HEIGHT})`,
									}),
								]}
							>
								{chunkRows(lines, start, end, selected, lineHref, blameCells)}
							</tbody>
						))}
					</table>
				</div>
				<CodeViewSelection
					menuId={`${viewId}-line-menu`}
					permalink={permalink}
					issueHref={issueHref}
					labels={labels}
				/>
			</div>
		);
	};
}

/**
 * Every rule the table and its rows follow, set once on the table so no row carries a
 * class of its own. Chunks lay their rows out on one grid of fixed tracks (blame, number,
 * code), so the columns line up across chunks while each chunk can be skipped on its own.
 *
 * @param digits Digits the widest line number needs.
 * @param hasBlame Whether rows carry a leading blame column.
 */
function tableRules(digits: number, hasBlame: boolean) {
	let numberWidth = `calc(${digits}ch + 2.25rem)`;
	let selected = "color-mix(in oklab, var(--ui-brand-fg) 14%, var(--code-view-bg))";
	let band = {
		backgroundColor: `var(--code-view-selected, ${selected})`,
	};
	let bar = { boxShadow: "inset 2px 0 0 var(--ui-brand-fg)" };

	return raw({
		display: "block",
		inlineSize: "max-content",
		minInlineSize: "100%",
		margin: 0,
		borderCollapse: "collapse",
		fontFamily: "var(--ui-font-mono, ui-monospace, monospace)",
		fontSize: "var(--code-view-font-size, 0.75rem)",
		lineHeight: LINE_HEIGHT,
		color: "var(--ui-neutral-fg-emphasis)",
		tabSize: 4,
		"--code-view-blame": hasBlame ? BLAME_WIDTH : "0px",
		"& > tbody": {
			display: "grid",
			gridTemplateColumns: hasBlame
				? `var(--code-view-blame) ${numberWidth} 1fr`
				: `${numberWidth} 1fr`,
			paddingBlock: 0,
			contentVisibility: "auto",
		},
		"& > tbody:first-child": { paddingBlockStart: "0.5rem" },
		"& > tbody:last-child": { paddingBlockEnd: "0.5rem" },
		"& tr": { display: "contents" },
		"& td": { padding: 0, verticalAlign: "top" },
		"& td:nth-last-child(2)": {
			gridColumn: hasBlame ? 2 : 1,
			position: "sticky",
			insetInlineStart: "var(--code-view-blame)",
			zIndex: 1,
			backgroundColor: "var(--code-view-bg)",
			userSelect: "none",
		},
		"& td:last-child": {
			gridColumn: hasBlame ? 3 : 2,
			paddingInline: "0.75rem 1.5rem",
			whiteSpace: "pre",
		},
		"& a[data-line-number]": {
			display: "block",
			paddingInline: "1.5rem 0.75rem",
			textAlign: "end",
			color: "var(--ui-neutral-fg-muted)",
			textDecoration: "none",
			cursor: "pointer",
			outline: "none",
		},
		"& a[data-line-number]::before": { content: "attr(data-line-number)" },
		"& a[data-line-number]:hover": { color: "var(--ui-neutral-fg-emphasis)" },
		"& a[data-line-number]:focus-visible": {
			color: "var(--ui-neutral-fg-emphasis)",
			boxShadow: "inset 0 0 0 2px var(--ui-brand-ring, var(--ui-brand-fg))",
			borderRadius: "var(--ui-radius-sm, 0.25rem)",
		},
		"& tr[data-selected] > td:not([data-blame])": band,
		"& tr[data-selected] > td:nth-last-child(2)": bar,
		"& tr[data-selected] a[data-line-number]": { color: "var(--ui-brand-fg)" },
		[`:not([data-selection-live]) > [data-slot="code-view-scroll"] > & tr:has(> td > a:target) > td:not([data-blame])`]:
			band,
		[`:not([data-selection-live]) > [data-slot="code-view-scroll"] > & tr:has(> td > a:target) > td:nth-last-child(2)`]:
			bar,
		"& td[data-blame]": {
			gridColumn: 1,
			display: "flex",
			flexDirection: "column",
			gap: "0.125rem",
			minInlineSize: 0,
			paddingBlock: "0.375rem",
			paddingInline: "0.75rem",
			borderBlockStart: "1px solid var(--ui-neutral-border)",
			borderInlineEnd: "3px solid var(--code-view-age)",
			fontFamily: "var(--ui-font-sans, system-ui, sans-serif)",
			fontSize: "0.75rem",
			lineHeight: "1rem",
			color: "var(--ui-neutral-fg-muted)",
			whiteSpace: "nowrap",
		},
		"& tbody:first-child > tr:first-child > td[data-blame]": {
			borderBlockStartColor: "transparent",
		},
		"& td[data-blame][data-continued]": { borderBlockStartColor: "transparent" },
		"& [data-slot='blame-subject']": {
			overflow: "hidden",
			textOverflow: "ellipsis",
			color: "var(--ui-neutral-fg-emphasis)",
			textDecoration: "none",
		},
		"& [data-slot='blame-subject']:hover": { textDecoration: "underline" },
		"& [data-slot='blame-meta']": {
			display: "flex",
			gap: "0.5rem",
			overflow: "hidden",
			textOverflow: "ellipsis",
		},
		...ageRules(),
		...codeTokenRules(),
		[`@container code-view (max-width: ${WRAP_WIDTH})`]: {
			"&": { inlineSize: "100%", "--code-view-blame": hasBlame ? BLAME_NARROW_WIDTH : "0px" },
			"& > tbody": {
				gridTemplateColumns: hasBlame
					? `var(--code-view-blame) ${numberWidth} minmax(0, 1fr)`
					: `${numberWidth} minmax(0, 1fr)`,
			},
			"& td:last-child": { whiteSpace: "pre-wrap", overflowWrap: "anywhere", minInlineSize: 0 },
			"& a[data-line-number]": { paddingInlineStart: "1.25rem" },
			"& [data-slot='blame-subject'], & [data-slot='blame-author']": { display: "none" },
		},
	});
}

/**
 * The age strip's colors, one `--code-view-age` per step from oldest (1) to newest
 * ({@link AGE_STEPS}). An app sets `--code-age-1` through `--code-age-5` to art-direct it;
 * the fallback deepens the brand tone toward the newest step in either scheme.
 */
function ageRules(): Record<string, Record<string, string>> {
	let rules: Record<string, Record<string, string>> = {};
	for (let step = 1; step <= AGE_STEPS; step += 1) {
		let strength = Math.round((step / AGE_STEPS) * 100);
		rules[`& td[data-blame][data-age="${step}"]`] = {
			"--code-view-age": `var(--code-age-${step}, color-mix(in oklab, var(--ui-brand-fg) ${strength}%, var(--code-view-bg)))`,
		};
	}
	return rules;
}

/** One chunk's first and last line, both counted from 1. */
function chunkRanges(count: number, size: number): LineRange[] {
	let ranges: LineRange[] = [];
	for (let start = 1; start <= count; start += size) {
		ranges.push({ start, end: Math.min(count, start + size - 1) });
	}
	return ranges;
}

/** A blame cell as one chunk draws it: the hunk's commit, spanning its rows in that chunk. */
interface BlameCell {
	commit: CodeView.BlameCommit;
	rows: number;
	/** Whether the hunk began in an earlier chunk, which draws only its strip here. */
	continued: boolean;
	age: number;
	time: RelativeTimeFormat.Formatted;
}

/**
 * Splits every hunk at chunk edges, since a cell spans rows only inside its own chunk, and
 * keys each piece by its first line. A hunk's age step ranks its commit's date between the
 * oldest and newest commit in the file.
 */
function blameSegments(
	hunks: readonly CodeView.BlameHunk[],
	count: number,
	size: number,
	format: RelativeTimeFormat.Options,
): Map<number, BlameCell> {
	let times = hunks.map((hunk) => new Date(hunk.commit.date).getTime());
	let oldest = Math.min(...times);
	let span = Math.max(...times) - oldest;
	let cells = new Map<number, BlameCell>();

	for (let [index, hunk] of hunks.entries()) {
		let age =
			span <= 0 ? AGE_STEPS : 1 + Math.round(((times[index]! - oldest) / span) * (AGE_STEPS - 1));
		let time = formatRelativeTime(hunk.commit.date, format);
		let end = Math.min(hunk.end, count);
		for (let start = Math.max(1, hunk.start); start <= end;) {
			let chunkEnd = Math.ceil(start / size) * size;
			let pieceEnd = Math.min(end, chunkEnd);
			cells.set(start, {
				commit: hunk.commit,
				rows: pieceEnd - start + 1,
				continued: start !== Math.max(1, hunk.start),
				age,
				time,
			});
			start = pieceEnd + 1;
		}
	}

	return cells;
}

/**
 * The rows of one chunk. Rows are plain local render values built in one loop: a file can
 * hold ten thousand of them, and each row is four elements (the row, two cells, the number
 * link) plus its runs, with no component instance or class of its own. A row that starts a
 * blame piece leads with the hunk's cell (subject, author, age); a continued piece draws
 * only its strip.
 */
function chunkRows(
	lines: CodeToken[][],
	start: number,
	end: number,
	selected: LineRange | undefined,
	lineHref: (line: number) => string,
	blame: Map<number, BlameCell> | undefined,
): RemixNode[] {
	let rows: RemixNode[] = [];
	for (let line = start; line <= end; line += 1) {
		let cell = blame?.get(line);
		let isSelected = selected !== undefined && line >= selected.start && line <= selected.end;
		let blameData = cell ? (
			<td
				data-blame=""
				data-age={cell.age}
				data-continued={cell.continued ? "" : undefined}
				rowSpan={cell.rows}
				mix={[raw({ gridRowEnd: `span ${cell.rows}` })]}
			>
				{cell.continued ? null : (
					<a href={cell.commit.href} data-slot="blame-subject" title={cell.commit.subject}>
						{cell.commit.subject}
					</a>
				)}
				{cell.continued ? null : (
					<span data-slot="blame-meta">
						<span data-slot="blame-author">{cell.commit.author}</span>
						<time dateTime={cell.time.dateTime} title={cell.time.title}>
							{cell.time.text}
						</time>
					</span>
				)}
			</td>
		) : null;
		rows.push(
			<tr data-selected={isSelected ? "" : undefined}>
				{blameData}
				<td>
					<a id={`L${line}`} href={lineHref(line)} data-line-number={line} />
				</td>
				<td>{renderRuns(lines[line - 1] ?? [])}</td>
			</tr>,
		);
	}
	return rows;
}

/**
 * A line's runs: plain text stays a text node, and each highlighted run is one
 * `span.token.<type>` the table's rules color. Neighbouring runs of one type merge first, so
 * no line holds two nodes where one would do.
 */
function renderRuns(runs: readonly CodeToken[]): RemixNode[] {
	let merged: CodeToken[] = [];
	for (let run of runs) {
		let type = CODE_TOKEN_PALETTE[run.type] ? run.type : "plain";
		let last = merged[merged.length - 1];
		if (last && last.type === type) last.value += run.value;
		else merged.push({ type, value: run.value });
	}
	return merged.map((run) =>
		run.type === "plain" ? run.value : <span className={`token ${run.type}`}>{run.value}</span>,
	);
}

/**
 * An element id derived from the path, so a cached page keeps the same ids on every render
 * of the same file.
 */
function stableId(value: string): string {
	let hash = FNV_OFFSET;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, FNV_PRIME);
	}
	return `code-view-${(hash >>> 0).toString(36)}`;
}

/**
 * Renders the file's header: its facts (lines, size) on the start side in tabular figures,
 * and its actions on the end side, wrapping under the facts on a narrow view.
 *
 * @param handle Runtime handle carrying the header's props.
 * @returns The render function producing the header.
 * @example <CodeView.Header meta={t("file.meta", { lines: 49, loc: 42, size: "1.75 KB" })}><LinkButton href={rawHref}>{t("file.raw")}</LinkButton></CodeView.Header>
 */
CodeView.Header = function CodeViewHeader(handle: Handle<CodeView.HeaderProps>) {
	return () => {
		let { children, meta, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="code-view-header"
				mix={mergeMix(
					[
						hstack({ gap: 3, align: "center", justify: "between" }),
						flexWrap("wrap"),
						pi(4),
						pb(2),
						raw({ minBlockSize: "2.75rem" }),
						bg("neutral.bg-tint"),
						borderEdge("block-end", { color: "neutral.border", width: 1, style: "solid" }),
					],
					mix,
				)}
			>
				<span
					data-slot="code-view-meta"
					mix={[text("xs"), fg("neutral.muted"), tabularNums(), minIs(0)]}
				>
					{meta}
				</span>
				{children ? (
					<span mix={[hstack({ gap: 2, align: "center" }), flexWrap("wrap")]}>{children}</span>
				) : null}
			</div>
		);
	};
};

/**
 * Renders the age strip's legend: the older label, one swatch per step in the strip's own
 * colors, and the newer label.
 *
 * @param handle Runtime handle carrying the legend's props.
 * @returns The render function producing the legend.
 * @example <CodeView.AgeLegend labels={{ older: t("blame.older"), newer: t("blame.newer") }} />
 */
CodeView.AgeLegend = function CodeViewAgeLegend(handle: Handle<CodeView.AgeLegendProps>) {
	return () => {
		let { labels, mix, ...rest } = handle.props;
		let steps = Array.from({ length: AGE_STEPS }, (_, index) => index + 1);
		return (
			<div
				{...rest}
				data-slot="code-view-age-legend"
				mix={mergeMix(
					[hstack({ gap: 1.5, align: "center" }), text("xs"), fg("neutral.muted")],
					mix,
				)}
			>
				<span>{labels.older}</span>
				<span aria-hidden="true" mix={[hstack({ gap: 0.5 })]}>
					{steps.map((step) => (
						<span
							data-age={step}
							mix={[
								is(2.5),
								bs(2.5),
								rounded("sm"),
								raw({
									backgroundColor: `var(--code-age-${step}, color-mix(in oklab, var(--ui-brand-fg) ${Math.round((step / AGE_STEPS) * 100)}%, var(--ui-surface-raised, Canvas)))`,
								}),
							]}
						/>
					))}
				</span>
				<span>{labels.newer}</span>
			</div>
		);
	};
};

/**
 * Client island every {@link CodeView} renders once: the line menu (Copy line, Copy
 * permalink, Reference in new issue) and the `codeViewSelection()` mixin that owns the
 * view's selection. Loads from `@sdxc/ui/app/code-view#CodeViewSelection` once the app's
 * browser entry maps it; until then each number links to its own `?L=` address.
 */
export const CodeViewSelection: EntryComponent<CodeView.SelectionProps> = clientEntry(
	"@sdxc/ui/app/code-view#CodeViewSelection",
	function CodeViewSelection(handle: Handle<CodeView.SelectionProps>) {
		return () => {
			let { issueHref, labels, menuId, permalink } = handle.props;
			return (
				<div
					data-slot="code-view-line-menu"
					mix={[
						codeViewSelection({ permalink, issueHref, labels }),
						raw({
							display: "none",
							position: "absolute",
							zIndex: 2,
							insetBlockStart: `calc(var(--code-view-menu-top, 0px) + ${LINE_HEIGHT} / 2 - 0.625rem)`,
							insetInlineStart: "calc(var(--code-view-menu-start, 0px) + 0.125rem)",
						}),
						when("[data-line-menu] > &", raw({ display: "block" })),
					]}
				>
					<button
						type="button"
						popovertarget={menuId}
						aria-label={labels.lineMenu}
						mix={[
							center(),
							shrink(),
							is(5),
							bs(5),
							rounded("sm"),
							fg("neutral"),
							bg("neutral.bg-tint"),
							raw({ border: "1px solid var(--ui-neutral-border)", padding: 0, cursor: "pointer" }),
							when("&:hover", bg("neutral.bg-tint-hover")),
							when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
						]}
					>
						<EllipsisIcon size={14} aria-hidden="true" />
					</button>
					<Menu id={menuId} aria-label={labels.lineMenu} placement="bottom-start">
						<Menu.Item data-action="copy-line">{labels.copyLine}</Menu.Item>
						<Menu.Item data-action="copy-permalink">{labels.copyPermalink}</Menu.Item>
						{issueHref && labels.referenceInNewIssue ? (
							<Menu.Item href={issueHref} data-action="reference">
								{labels.referenceInNewIssue}
							</Menu.Item>
						) : null}
					</Menu>
					<span role="status" mix={[visuallyHidden()]} />
				</div>
			);
		};
	},
);
