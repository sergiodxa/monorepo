/**
 * A CI job's log: one native `<details>` per step (the failed one open), numbered lines whose
 * numbers are links painted from attributes so a copy skips them, `##[group]` folds, ANSI
 * colours as toned spans, a live step that streams its lines, and an island for log search.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent, Handle, Props as TagProps } from "remix/component";

import {
	ArrowDownIcon,
	ChevronDownIcon,
	ChevronRightIcon,
	ChevronUpIcon,
	CircleCheckIcon,
	CircleDashedIcon,
	CircleSlashIcon,
	CircleStopIcon,
	CircleXIcon,
	LoaderCircleIcon,
	SearchIcon,
} from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { fg, outline } from "@sdxc/u/color";
import { mergeMix, raw } from "@sdxc/u/general";
import { data, focusVisible, hover, when } from "@sdxc/u/state";
import { font, tabularNums, text, weight } from "@sdxc/u/typography";
import { attrs, clientEntry } from "remix/component";

import { spin } from "../animations/keyframes.js";

import type { LogViewerController as LogViewerControllerOptions } from "./mixins/log-viewer.js";
import type { AnsiSpan } from "./utils/ansi.js";
import type { LogLine, LogNode } from "./utils/log-lines.js";

import { logViewerController } from "./mixins/log-viewer.js";
import {
	LOG_LINE_PLACEHOLDER,
	ansiAttributes,
	buildLogTree,
	chunkLogNodes,
	formatLogTime,
} from "./utils/log-lines.js";

export type { AnsiColor, AnsiLine, AnsiSpan, AnsiStyle } from "./utils/ansi.js";
export { parseAnsi, parseAnsiLine, stripAnsi } from "./utils/ansi.js";
export type { LogEntry, LogLine, LogNode, LogTone } from "./utils/log-lines.js";
export { buildLogTree, formatLogTime, readMarker, splitTimestamp } from "./utils/log-lines.js";

/** Lines per chunk: each chunk is one box the browser skips painting while it is off screen. */
const CHUNK_LINES = 200;

/** The height one log line takes, which an off-screen chunk reserves per line. */
const LINE_HEIGHT = "1.25rem";

/** The number column's width. */
const GUTTER = "3.5rem";

/** The number and time columns' width together, with timestamps on. */
const GUTTER_WITH_TIME = "9rem";

/**
 * Types for {@link LogViewer} and its parts.
 */
export namespace LogViewer {
	/** Where a step stands. */
	export type State = "success" | "failure" | "running" | "queued" | "skipped" | "cancelled";

	/** One step of the job. */
	export interface Step {
		name: string;
		state: State;
		/** How long it took, already formatted, e.g. "1m 12s". */
		duration?: string;
		lines: LogLine[];
		/** Starts open; a failed step does by default and every other step starts closed. */
		open?: boolean;
		/** Makes the step live: its further lines stream from `src`, and `refresh` reloads the page. */
		stream?: StreamSource;
	}

	/** Where a running step's further lines come from. */
	export interface StreamSource {
		/**
		 * A URL answering the step's lines after those already drawn, as a streamed `text/plain`
		 * body of one line per `\n`; a line may start with an ISO timestamp and a space.
		 */
		src: string;
		/** The page's own address, offered as a "Refresh" link while the stream is not running. */
		refresh: string;
	}

	/** Every string the viewer shows or announces. */
	export interface Labels {
		/** Names the scrolling log, e.g. "Job log". */
		log: string;
		/** Each state's accessible name, read for the step's icon: "Failed", "In progress"… */
		states: Record<State, string>;
		/** The search field's label, e.g. "Search logs". */
		search: string;
		/** The match counter, with `{index}` and `{count}` replaced, e.g. "{index} of {count}". */
		matches: string;
		/** Shown in place of the counter when nothing matches, e.g. "No results". */
		noMatches: string;
		previousMatch: string;
		nextMatch: string;
		showTimestamps: string;
		hideTimestamps: string;
		/** The pill shown when lines arrive below the view, e.g. "Jump to latest". */
		jumpToLatest: string;
		/** The no-script link that reloads a running job's log, e.g. "Refresh". */
		refresh: string;
	}

	/** Props for {@link LogViewer}. */
	export interface Props extends Omit<TagProps<"section">, "children"> {
		steps: Step[];
		/** A line's link, e.g. `(step, n) => "#step:" + step + ":" + n`; its fragment becomes the line's id. */
		lineHref: (step: number, n: number) => string;
		/** Draws each line's time beside its number. */
		timestamps?: boolean;
		/** The page with timestamps toggled, e.g. `?ts=1`; omitted, the toggle is not drawn. */
		timestampsHref?: string;
		labels: Labels;
	}

	/** Props for {@link LogViewer.Stream}. */
	export interface StreamProps {
		/** The step's position in the job, from 1, as `lineHref` receives it. */
		index: number;
		step: Step & { stream: StreamSource };
		lineHref: (step: number, n: number) => string;
		labels: Labels;
	}

	/** Props for {@link LogViewerController}; plain data, since they cross into the browser. */
	export type ControllerProps = LogViewerControllerOptions.Options;
}

/** The id a line takes: its link's fragment, so following the link scrolls to and paints it. */
function idFromHref(href: string): string | undefined {
	let hash = href.indexOf("#");
	return hash === -1 ? undefined : decodeURIComponent(href.slice(hash + 1));
}

/** Whether a span carries any style, so a plain one renders as a bare text node. */
function isStyled(span: AnsiSpan): boolean {
	return Object.keys(span).length > 1;
}

/** The colours and weights of ANSI spans and line tones, set once on the viewer for every line. */
function logStyles() {
	let tone = (name: string) => `var(--ui-${name}-fg)`;
	let tint = (name: string, amount: number) =>
		`color-mix(in oklab, var(--ui-${name}-fg) ${amount}%, transparent)`;
	return raw({
		"& [data-fg=red]": { color: tone("danger") },
		"& [data-fg=green]": { color: tone("success") },
		"& [data-fg=yellow]": { color: tone("warning") },
		"& :is([data-fg=blue], [data-fg=cyan], [data-fg=magenta])": { color: tone("brand") },
		"& [data-fg=black]": { color: "var(--ui-neutral-fg-muted, GrayText)" },
		"& [data-fg=white]": { color: "var(--ui-neutral-fg-emphasis, CanvasText)" },
		"& [data-bg=red]": { backgroundColor: tint("danger", 25) },
		"& [data-bg=green]": { backgroundColor: tint("success", 25) },
		"& [data-bg=yellow]": { backgroundColor: tint("warning", 25) },
		"& :is([data-bg=blue], [data-bg=cyan], [data-bg=magenta])": {
			backgroundColor: tint("brand", 25),
		},
		"& :is([data-bg=black], [data-bg=white])": { backgroundColor: tint("neutral", 20) },
		"& [data-b]": { fontWeight: "600" },
		"& [data-dim]": { opacity: "0.7" },
		"& [data-i]": { fontStyle: "italic" },
		"& [data-u]": { textDecoration: "underline" },
		"& [data-log-line][data-tone=danger]": {
			color: tone("danger"),
			backgroundColor: tint("danger", 10),
		},
		"& [data-log-line][data-tone=warning]": {
			color: tone("warning"),
			backgroundColor: tint("warning", 10),
		},
		"& [data-log-line][data-tone=notice]": { color: tone("brand") },
		"& [data-log-line][data-tone=command]": { color: tone("brand") },
		"& [data-log-line][data-tone=muted]": { opacity: "0.7" },
	});
}

/** The layout of every line: a hanging gutter for the painted number and time, then the text. */
function lineStyles() {
	return raw({
		"& [data-log-line]": {
			display: "block",
			minBlockSize: LINE_HEIGHT,
			paddingInlineStart: "var(--ui-log-gutter)",
			paddingInlineEnd: "1rem",
			whiteSpace: "pre-wrap",
			overflowWrap: "anywhere",
			tabSize: "4",
		},
		"& [data-log-line]:hover": {
			backgroundColor: "color-mix(in oklab, var(--ui-neutral-fg) 6%, transparent)",
		},
		"& [data-log-line]:target, & [data-log-line][data-log-current]": {
			backgroundColor: "color-mix(in oklab, var(--ui-warning-fg) 16%, transparent)",
			boxShadow: "inset 2px 0 0 var(--ui-warning-fg)",
		},
		"& [data-log-line] > a:first-child": {
			display: "inline-grid",
			gridAutoFlow: "column",
			gridTemplateColumns: `${GUTTER} 1fr`,
			inlineSize: "var(--ui-log-gutter)",
			marginInlineStart: "calc(-1 * var(--ui-log-gutter))",
			verticalAlign: "top",
			color: "var(--ui-neutral-fg-muted, GrayText)",
			textDecoration: "none",
			userSelect: "none",
			fontVariantNumeric: "tabular-nums",
		},
		"& [data-log-line] > a:first-child::before": {
			content: "attr(data-n)",
			textAlign: "end",
			paddingInlineEnd: "1rem",
		},
		"& [data-log-line] > a:first-child:hover": { color: "var(--ui-neutral-fg-emphasis)" },
		"&[data-timestamps] [data-log-line] > a:first-child::after": {
			content: "attr(data-ts)",
			paddingInlineEnd: "1rem",
		},
		"& [data-log-chunk]": {
			contentVisibility: "auto",
			containIntrinsicBlockSize: `auto calc(var(--ui-log-chunk-lines, ${CHUNK_LINES}) * ${LINE_HEIGHT})`,
		},
		"& [data-log-group] > summary": { listStyle: "none", cursor: "pointer" },
		"& [data-log-group] > summary::-webkit-details-marker": { display: "none" },
		"& [data-log-group-title]::before": { content: '"▸ "', color: "var(--ui-neutral-fg-muted)" },
		"& [data-log-group][open] > summary [data-log-group-title]::before": { content: '"▾ "' },
		"& [data-log-group-body]": { paddingInlineStart: "1rem" },
		"& *::highlight(ui-log-match)": {
			backgroundColor: "color-mix(in oklab, var(--ui-warning-fg) 35%, transparent)",
		},
		"& *::highlight(ui-log-current)": {
			backgroundColor: "var(--ui-warning-fg)",
			color: "var(--ui-bg, Canvas)",
		},
	});
}

/** Props {@link LogNodes} reads. */
interface LogNodesProps {
	nodes: readonly LogNode[];
	/** The line link for line `n` of this step. */
	href: (n: number) => string;
}

/**
 * Draws sibling nodes as chunks of about {@link CHUNK_LINES} lines. Each line is one element
 * holding an empty link and its text, so a plain line costs three nodes in a 20,000-line log.
 */
function LogNodes(handle: Handle<LogNodesProps>) {
	return () => {
		let { nodes, href } = handle.props;
		return (
			<>
				{chunkLogNodes(nodes, CHUNK_LINES).map((chunk) => (
					<div
						data-log-chunk
						style={`--ui-log-chunk-lines: ${chunk.reduce((sum, node) => sum + (node.kind === "group" ? node.lines : 1), 0)}`}
					>
						{chunk.map((node) => {
							let link = href(node.entry.n);
							let number = (
								<a
									href={link}
									data-n={node.entry.n}
									data-ts={node.entry.ts === undefined ? undefined : formatLogTime(node.entry.ts)}
									tabindex={-1}
									aria-hidden="true"
								/>
							);
							let spans = node.entry.spans.map((span) =>
								isStyled(span) ? <span {...ansiAttributes(span)}>{span.text}</span> : span.text,
							);
							if (node.kind === "line") {
								return (
									<div data-log-line id={idFromHref(link)} data-tone={node.entry.tone}>
										{number}
										{spans}
									</div>
								);
							}
							return (
								<details data-log-group open={node.hasError}>
									<summary data-log-line id={idFromHref(link)} data-tone={node.entry.tone}>
										{number}
										<span data-log-group-title>{spans}</span>
									</summary>
									<div data-log-group-body>
										<LogNodes nodes={node.children} href={href} />
									</div>
								</details>
							);
						})}
					</div>
				))}
			</>
		);
	};
}

/** The icon each state draws, toned by what it means. */
function StateIcon(handle: Handle<{ state: LogViewer.State; label: string }>) {
	return () => {
		let { state, label } = handle.props;
		let size = 16;
		let icon = (() => {
			if (state === "success") return <CircleCheckIcon size={size} aria-hidden="true" />;
			if (state === "failure") return <CircleXIcon size={size} aria-hidden="true" />;
			if (state === "running") {
				return <LoaderCircleIcon size={size} aria-hidden="true" mix={[spin()]} />;
			}
			if (state === "skipped") return <CircleSlashIcon size={size} aria-hidden="true" />;
			if (state === "cancelled") return <CircleStopIcon size={size} aria-hidden="true" />;
			return <CircleDashedIcon size={size} aria-hidden="true" />;
		})();
		return (
			<span
				role="img"
				aria-label={label}
				data-state={state}
				mix={[
					raw({ display: "inline-flex", flexShrink: "0" }),
					fg("neutral.muted"),
					data("state", "success", fg("success")),
					data("state", "failure", fg("danger")),
					data("state", "running", fg("warning")),
				]}
			>
				{icon}
			</span>
		);
	};
}

/** Props {@link LogStep} reads. */
interface LogStepProps {
	index: number;
	step: LogViewer.Step;
	lineHref: (step: number, n: number) => string;
	labels: LogViewer.Labels;
}

/**
 * One step as a `<details>`: a summary row (chevron, state, name, duration) that sticks to the
 * top of the log while the step is open, then its lines. A live step adds the container its
 * streamed lines land in and the no-script Refresh link.
 */
function LogStep(handle: Handle<LogStepProps>) {
	return () => {
		let { index, step, lineHref, labels } = handle.props;
		let open = step.open ?? (step.state === "failure" || step.stream !== undefined);
		let nodes = buildLogTree(step.lines);
		let last = step.lines.at(-1)?.n ?? 0;
		let live = step.stream;
		return (
			<details
				data-log-step={index}
				data-state={step.state}
				open={open}
				{...(live
					? {
							"data-log-stream": live.src,
							"data-log-next": String(last + 1),
							"data-log-href": lineHref(index, LOG_LINE_PLACEHOLDER),
							"data-stream-pending": "",
						}
					: {})}
				mix={[
					raw({ borderBlockEnd: "1px solid var(--ui-neutral-border)" }),
					when("&:last-child", raw({ borderBlockEnd: "none" })),
				]}
			>
				<summary
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							minBlockSize: "2.5rem",
							paddingInline: "0.75rem",
							listStyle: "none",
							cursor: "pointer",
							fontFamily: "var(--ui-font-sans, system-ui, sans-serif)",
							"&::-webkit-details-marker": { display: "none" },
						}),
						text("sm"),
						hover(raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
						focusVisible(outline({ color: "brand.ring", offset: -2, width: 2 })),
						when(
							":is(details[open]) > &",
							raw({
								position: "sticky",
								insetBlockStart: "0",
								zIndex: "1",
								backgroundColor: "var(--ui-log-viewer-surface, var(--ui-bg, Canvas))",
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
							}),
						),
						when(
							":is(details[open]) > & [data-slot=log-step-chevron]",
							raw({ transform: "rotate(90deg)" }),
						),
					]}
				>
					<ChevronRightIcon
						size={14}
						aria-hidden="true"
						data-slot="log-step-chevron"
						mix={[
							raw({ flexShrink: "0", transition: "transform 150ms ease" }),
							fg("neutral.muted"),
						]}
					/>
					<StateIcon state={step.state} label={labels.states[step.state]} />
					<span data-slot="log-step-name" mix={[raw({ flex: "1 1 auto", minInlineSize: "0" })]}>
						{step.name}
					</span>
					{step.duration ? (
						<span mix={[fg("neutral.muted"), text("xs"), tabularNums()]}>{step.duration}</span>
					) : null}
				</summary>
				<div data-slot="log-step-body" mix={[raw({ paddingBlock: "0.25rem 0.5rem" })]}>
					<LogNodes nodes={nodes} href={(n) => lineHref(index, n)} />
					{live ? <div data-log-live /> : null}
				</div>
				{live ? (
					<p data-log-refresh mix={[raw({ margin: "0", padding: "0 0.75rem 0.5rem" }), text("sm")]}>
						<a href={live.refresh} mix={[fg("brand")]}>
							{labels.refresh}
						</a>
					</p>
				) : null}
			</details>
		);
	};
}

/**
 * Renders the job's log: a toolbar (search, once the island runs, and the timestamps toggle),
 * then every step in one scrolling box. Every line is in the page from the start, so the
 * browser's find-in-page and selection work over all of it, closed steps included.
 *
 * @param handle Runtime handle carrying the viewer's props.
 * @returns The render function producing the viewer.
 * @example
 * <LogViewer steps={job.steps} lineHref={(step, n) => `#step:${step}:${n}`} timestamps={ts} timestampsHref={ts ? "?" : "?ts=1"} labels={labels} />
 */
export function LogViewer(handle: Handle<LogViewer.Props>) {
	return () => {
		let {
			steps,
			lineHref,
			timestamps = false,
			timestampsHref,
			labels,
			mix,
			...rest
		} = handle.props;
		return (
			<section
				data-slot="log-viewer"
				data-timestamps={timestamps ? "" : undefined}
				{...rest}
				mix={mergeMix(
					[
						raw({
							"--ui-log-gutter": timestamps ? GUTTER_WITH_TIME : GUTTER,
							position: "relative",
							display: "flex",
							flexDirection: "column",
							minInlineSize: "0",
							border: "1px solid var(--ui-neutral-border)",
							borderRadius: "0.5rem",
							backgroundColor: "var(--ui-log-viewer-surface, var(--ui-bg, Canvas))",
							overflow: "clip",
						}),
						lineStyles(),
						logStyles(),
					],
					mix,
				)}
			>
				<div
					data-slot="log-viewer-toolbar"
					mix={[
						raw({
							display: "flex",
							flexWrap: "wrap",
							alignItems: "center",
							justifyContent: "flex-end",
							gap: "0.5rem",
							padding: "0.5rem 0.75rem",
							borderBlockEnd: "1px solid var(--ui-neutral-border)",
						}),
						text("sm"),
					]}
				>
					<LogSearch labels={labels} />
					{timestampsHref ? (
						<a
							href={timestampsHref}
							aria-pressed={timestamps ? "true" : "false"}
							role="button"
							data-slot="log-viewer-timestamps"
							mix={[
								fg("neutral.muted"),
								hover(fg("neutral.emphasis")),
								focusVisible(outline({ color: "brand.ring", offset: 2 })),
								raw({ textDecoration: "none", whiteSpace: "nowrap" }),
							]}
						>
							{timestamps ? labels.hideTimestamps : labels.showTimestamps}
						</a>
					) : null}
				</div>
				<div
					data-slot="log-viewer-body"
					role="region"
					aria-label={labels.log}
					mix={[
						attrs({ tabIndex: 0 }),
						raw({
							overflow: "auto",
							maxBlockSize: "var(--ui-log-viewer-height, min(70vh, 48rem))",
							overscrollBehavior: "contain",
							fontSize: "0.75rem",
							lineHeight: LINE_HEIGHT,
						}),
						font("mono"),
						focusVisible(outline({ color: "brand.ring", offset: -2, width: 2 })),
					]}
				>
					{steps.map((step, position) =>
						step.stream ? (
							<LogViewer.Stream
								index={position + 1}
								step={step as LogViewer.StreamProps["step"]}
								lineHref={lineHref}
								labels={labels}
							/>
						) : (
							<LogStep index={position + 1} step={step} lineHref={lineHref} labels={labels} />
						),
					)}
				</div>
				<button
					type="button"
					hidden
					data-log-jump
					mix={[
						raw({
							position: "absolute",
							insetBlockEnd: "1rem",
							insetInlineStart: "50%",
							transform: "translateX(-50%)",
							zIndex: "2",
							display: "inline-flex",
							alignItems: "center",
							gap: "0.375rem",
							padding: "0.375rem 0.875rem",
							border: "none",
							borderRadius: "999px",
							backgroundColor: "var(--ui-brand-bg-solid)",
							color: "var(--ui-brand-fg-on-solid, white)",
							boxShadow: "0 4px 12px rgb(0 0 0 / 0.2)",
							cursor: "pointer",
							"&[hidden]": { display: "none" },
						}),
						text("sm"),
						weight("medium"),
						focusVisible(outline({ color: "brand.ring", offset: 2, width: 2 })),
					]}
				>
					<ArrowDownIcon size={14} aria-hidden="true" />
					{labels.jumpToLatest}
				</button>
				<LogViewerController matches={labels.matches} noMatches={labels.noMatches} />
			</section>
		);
	};
}

/**
 * Renders the step the viewer draws for a running step: the lines so far, then each line the
 * stream answers appended in place while the log follows its tail. Without script, or when the
 * stream fails or ends, it offers a Refresh link to the page instead.
 *
 * @param handle Runtime handle carrying the step and its stream.
 * @returns The render function producing the live step.
 * @example <LogViewer.Stream index={4} step={{ ...step, stream: { src: "/runs/7/steps/4/log?after=120", refresh: "/runs/7" } }} lineHref={href} labels={labels} />
 */
LogViewer.Stream = function LogViewerStream(handle: Handle<LogViewer.StreamProps>) {
	return () => <LogStep {...handle.props} />;
};

/**
 * The search box the island reveals: a field, the match counter and previous/next buttons.
 * It stays hidden without script, where the browser's own find-in-page covers the log.
 */
function LogSearch(handle: Handle<{ labels: LogViewer.Labels }>) {
	return () => {
		let { labels } = handle.props;
		let buttonMix = [
			raw({
				display: "inline-flex",
				alignItems: "center",
				justifyContent: "center",
				inlineSize: "1.75rem",
				blockSize: "1.75rem",
				padding: "0",
				border: "none",
				borderRadius: "0.375rem",
				background: "none",
				color: "inherit",
				cursor: "pointer",
			}),
			hover(raw({ backgroundColor: "var(--ui-neutral-bg-tint-hover)" })),
			focusVisible(outline({ color: "brand.ring", offset: 0, width: 2 })),
		];
		return (
			<div
				role="search"
				hidden
				data-log-search
				mix={[
					raw({
						display: "flex",
						alignItems: "center",
						gap: "0.25rem",
						marginInlineEnd: "auto",
						flex: "1 1 16rem",
						maxInlineSize: "24rem",
						"&[hidden]": { display: "none" },
					}),
				]}
			>
				<label
					mix={[
						raw({
							display: "flex",
							alignItems: "center",
							gap: "0.375rem",
							flex: "1 1 auto",
							minInlineSize: "0",
							blockSize: "2rem",
							paddingInline: "0.5rem",
							border: "1px solid var(--ui-neutral-border)",
							borderRadius: "0.375rem",
							"&:focus-within": { outline: "2px solid var(--ui-brand-ring)" },
						}),
					]}
				>
					<SearchIcon size={14} aria-hidden="true" mix={[fg("neutral.muted")]} />
					<span mix={[visuallyHidden()]}>{labels.search}</span>
					<input
						type="search"
						data-log-search-input
						placeholder={labels.search}
						autocomplete="off"
						spellcheck={false}
						mix={[
							raw({
								flex: "1 1 auto",
								minInlineSize: "0",
								border: "none",
								outline: "none",
								background: "none",
								color: "inherit",
								font: "inherit",
								fontSize: "max(16px, 0.875rem)",
							}),
						]}
					/>
					<span
						data-log-search-count
						role="status"
						mix={[fg("neutral.muted"), text("xs"), tabularNums(), raw({ whiteSpace: "nowrap" })]}
					/>
				</label>
				<button
					type="button"
					data-log-search-previous
					aria-label={labels.previousMatch}
					mix={buttonMix}
				>
					<ChevronUpIcon size={16} aria-hidden="true" />
				</button>
				<button type="button" data-log-search-next aria-label={labels.nextMatch} mix={buttonMix}>
					<ChevronDownIcon size={16} aria-hidden="true" />
				</button>
			</div>
		);
	};
}

/**
 * The viewer's island: renders nothing visible and wires the log it sits in once loaded, for
 * search, streaming and following the tail. `LogViewer` places it; load
 * `@sdxc/ui/app/log-viewer` in the browser entry.
 */
export const LogViewerController: EntryComponent<LogViewer.ControllerProps> = clientEntry(
	"@sdxc/ui/app/log-viewer#LogViewerController",
	function LogViewerController(handle: Handle<LogViewer.ControllerProps>) {
		return () => <div hidden mix={[logViewerController(handle.props)]} />;
	},
);
