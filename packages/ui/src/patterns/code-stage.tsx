/**
 * A titled mono panel for install samples, CLI output, or code snippets on a
 * landing, optionally highlighted, numbered, or split into file tabs that switch
 * through a radio group alone. The actions slot holds a copy control the page supplies.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Token } from "@sdxc/highlight";
import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { tokenize } from "@sdxc/highlight";
import { visuallyHidden } from "@sdxc/u/a11y";
import { border, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { overflowX } from "@sdxc/u/overflow";
import { m } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text, weight } from "@sdxc/u/typography";

import { marketingSurface } from "../styles/marketing.js";

/** Corner radius of a framed window or panel; a page sets `--ui-marketing-radius-frame` once. */
const FRAME_RADIUS = "var(--ui-marketing-radius-frame, 0.75rem)";

/** Panel chrome {@link CodeStage} applies when `variant` is omitted. */
const DEFAULT_VARIANT: CodeStage.Variant = "code";

/** Light ink a slab sets its code in, readable on the slab in both schemes. */
const SLAB_INK = "oklch(0.93 0 0)";

/** Header text and rules on the dark terminal panel, derived from the page canvas. */
const TERMINAL_MUTED = "color-mix(in oklab, Canvas 70%, transparent)";

/**
 * Inline start of the code, shared by the body's padding and the header's, so a
 * title or tab strip starts on the code's column.
 */
const INSET = "var(--ui-code-stage-inset, 1rem)";

/** Fixed header height, the same in every variant so stacked stages line up. */
const HEADER_HEIGHT = "2.5rem";

/** Size and leading the code is set at; the slab keeps its 24px rhythm. */
const CODE_FONT_SIZE = "0.8125rem";

/** The gutter's share of the line ink: 60% reads at 4.5:1 or better on every panel. */
const GUTTER_INK = "color-mix(in oklab, currentColor 60%, transparent)";

/**
 * Token colors as `[light, dark]` pairs, the light and dark GitHub palettes the
 * shared highlight stylesheet ships, used when no page palette declares the
 * matching `--highlight-*` property.
 */
const TOKEN_PALETTE: Record<Exclude<Token.Type, "plain">, readonly [string, string]> = {
	comment: ["#6a737d", "#8b949e"],
	keyword: ["#d73a49", "#ff7b72"],
	operator: ["#d73a49", "#ff7b72"],
	string: ["#032f62", "#a5d6ff"],
	builtin: ["#032f62", "#a5d6ff"],
	"attr-name": ["#032f62", "#a5d6ff"],
	"attr-value": ["#032f62", "#a5d6ff"],
	number: ["#005cc5", "#79c0ff"],
	boolean: ["#005cc5", "#79c0ff"],
	constant: ["#005cc5", "#79c0ff"],
	property: ["#005cc5", "#79c0ff"],
	tag: ["#005cc5", "#79c0ff"],
	function: ["#6f42c1", "#d2a8ff"],
	"class-name": ["#6f42c1", "#d2a8ff"],
	regex: ["#e36209", "#ffa657"],
	variable: ["#e36209", "#ffa657"],
	punctuation: ["#24292f", "#e6edf3"],
	inserted: ["#22863a", "#7ee787"],
	deleted: ["#b31d28", "#ffa198"],
};

/**
 * The slab is dark in both schemes, so it re-points every token property at the
 * dark palette, whatever the page's palette declares for its own scheme.
 */
const SLAB_TOKENS = Object.fromEntries(
	Object.entries(TOKEN_PALETTE).map(([type, [, dark]]) => [`--highlight-${type}`, dark]),
);

/**
 * The terminal panel inverts the page's scheme, so each token property takes the
 * palette of the opposite scheme.
 */
const TERMINAL_TOKENS = Object.fromEntries(
	Object.entries(TOKEN_PALETTE).map(([type, [light, dark]]) => [
		`--highlight-${type}`,
		`light-dark(${dark}, ${light})`,
	]),
);

/**
 * Prop types for {@link CodeStage}.
 */
export namespace CodeStage {
	/**
	 * Surface treatment: a raised code card, a darker terminal panel, or a slab
	 * that stays dark in both schemes and holds a translucent code sheet.
	 */
	export type Variant = "code" | "terminal" | "slab";

	/**
	 * One file of a tabbed stage: the tab's label and the source its panel shows.
	 */
	export interface Tab {
		/** Visible tab label, typically a file name. */
		label: RemixNode;
		/** Optional glyph drawn before the label. */
		icon?: RemixNode;
		/** Source the panel shows; a string highlights and numbers. */
		content: RemixNode;
		/** Language this file highlights as; falls back to the stage's `language`. */
		language?: string;
	}

	/**
	 * Per-part styling for chrome the stage renders besides its host.
	 */
	export interface PartsProps {
		/** Styling for the optional title bar. */
		header?: TagProps<"div">["mix"];
		/** Styling for each mono body that wraps code. */
		body?: TagProps<"pre">["mix"];
	}

	/**
	 * Props accepted by {@link CodeStage}.
	 */
	export interface Props extends Omit<TagProps<"div">, "title"> {
		/** Surface treatment. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** Optional title or path shown in the header; tabs take its place. */
		title?: RemixNode;
		/** Optional trailing control in the header — typically a copy button. */
		actions?: RemixNode;
		/**
		 * Highlights string content as this language (any name or alias
		 * `@sdxc/highlight` resolves). Element children render as given.
		 */
		language?: string;
		/**
		 * Numbers each line in a gutter beside the code. Numbering reads lines from
		 * a string; any other content renders unnumbered.
		 */
		lineNumbers?: boolean;
		/**
		 * Files shown as header tabs, switched by a radio group with no script; the
		 * first is selected and the stage keeps the tallest file's height.
		 */
		tabs?: Tab[];
		/** Radio group name for `tabs`; defaults to an id unique to this stage. */
		name?: string;
		/** Per-part styling for header and body. */
		parts?: PartsProps;
		/** Mono body content when `tabs` is omitted — a command, snippet, or output. */
		children?: RemixNode;
	}
}

/**
 * Content ready to place in a `pre`, with the line count when it was numbered.
 */
interface Painted {
	nodes: RemixNode;
	lineCount: number | null;
}

/**
 * Renders an optional titled or tabbed header and a mono body that keeps every
 * line intact and scrolls sideways inside the panel when a line outgrows it.
 * The stage takes its content's height, so beside taller copy it sits at the top.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the stage's markup.
 * @example
 * <CodeStage title="install.sh" actions={copyControl}>bun add @sdxc/ui</CodeStage>
 * @example
 * <CodeStage variant="slab" language="ts" lineNumbers>{snippet}</CodeStage>
 * @example
 * <CodeStage tabs={[{ label: "worker.ts", content: worker, language: "ts" }]} />
 */
export function CodeStage(handle: Handle<CodeStage.Props>) {
	return () => {
		let {
			actions,
			children,
			language,
			lineNumbers,
			mix,
			name,
			parts,
			tabs,
			title,
			variant,
			...rest
		} = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let files = tabs ?? [];
		let hasTabs = files.length > 0;
		let showHeader = hasTabs || title !== undefined || actions !== undefined;
		let single = hasTabs ? null : paint(children, language, lineNumbers === true);
		let groupName = name ?? `code-stage-${handle.id}`;

		return (
			<div
				{...rest}
				data-slot="code-stage"
				data-variant={resolvedVariant}
				mix={[
					vstack({ gap: 0, align: "stretch" }),
					raw({ minInlineSize: 0, maxInlineSize: "100%", blockSize: "fit-content" }),
					hostSurface(resolvedVariant),
					single?.lineCount ? raw(gutterProperty(single.lineCount)) : [],
					mix,
				]}
			>
				{showHeader ? (
					<div
						data-slot="code-stage-header"
						mix={[headerChrome(resolvedVariant, hasTabs), parts?.header]}
					>
						{hasTabs ? (
							<div data-slot="code-stage-tabs" mix={[hstack({ gap: 1, align: "center" })]}>
								{files.map((tab, index) => (
									<TabControl
										tab={tab}
										inputId={`${groupName}-tab-${index}`}
										name={groupName}
										value={String(index)}
										defaultChecked={index === 0}
										variant={resolvedVariant}
									/>
								))}
							</div>
						) : (
							<span mix={[raw({ display: "inline-flex", alignItems: "center", minInlineSize: 0 })]}>
								{single?.lineCount ? (
									<span
										aria-hidden="true"
										data-slot="code-stage-gutter-spacer"
										mix={[
											font("mono"),
											raw({
												fontSize: CODE_FONT_SIZE,
												flexShrink: 0,
												inlineSize: "var(--ui-code-stage-gutter)",
											}),
										]}
									/>
								) : null}
								{title ? <StageTitle variant={resolvedVariant}>{title}</StageTitle> : null}
							</span>
						)}
						{actions}
					</div>
				) : null}

				{hasTabs ? (
					<div
						data-slot="code-stage-panels"
						mix={[
							raw({
								display: "grid",
								gridTemplate: "minmax(0, 1fr) / minmax(0, 1fr)",
								minInlineSize: 0,
							}),
						]}
					>
						{files.map((tab, index) => {
							let painted = paint(tab.content, tab.language ?? language, lineNumbers === true);
							let inputId = `${groupName}-tab-${index}`;
							return (
								<CodeBody
									variant={resolvedVariant}
									lineCount={painted.lineCount}
									data-slot="code-stage-panel"
									mix={[
										raw({ gridArea: "1 / 1", visibility: "hidden" }),
										when(
											`:is([data-slot="code-stage"]:has([id="${inputId}"]:checked)) &`,
											raw({ visibility: "visible" }),
										),
										painted.lineCount ? raw(gutterProperty(painted.lineCount)) : [],
										parts?.body,
									]}
								>
									{painted.nodes}
								</CodeBody>
							);
						})}
					</div>
				) : (
					<CodeBody
						variant={resolvedVariant}
						lineCount={single?.lineCount ?? null}
						mix={parts?.body}
					>
						{single?.nodes}
					</CodeBody>
				)}
			</div>
		);
	};
}

/**
 * Props accepted by {@link StageTitle}.
 */
interface StageTitleProps {
	variant: CodeStage.Variant;
	children: RemixNode;
}

/**
 * The header's title at 12px in the muted ink of its variant, a step below the
 * 13px code so the code reads first.
 *
 * @param handle Runtime handle carrying the title's props.
 * @returns The render function producing the title.
 */
function StageTitle(handle: Handle<StageTitleProps>) {
	return () => {
		let { children, variant } = handle.props;
		return (
			<span
				data-slot="code-stage-title"
				mix={[
					font("mono"),
					text("xs"),
					weight("medium"),
					raw({ minInlineSize: 0, overflow: "hidden", textOverflow: "ellipsis" }),
					variant === "code"
						? fg("neutral")
						: raw({ color: variant === "slab" ? "rgb(255 255 255 / 0.6)" : TERMINAL_MUTED }),
				]}
			>
				{children}
			</span>
		);
	};
}

/**
 * Props accepted by {@link TabControl}.
 */
interface TabControlProps {
	tab: CodeStage.Tab;
	inputId: string;
	name: string;
	value: string;
	defaultChecked: boolean;
	variant: CodeStage.Variant;
}

/**
 * One file tab: a visually hidden radio and the label that selects it. The
 * label lifts onto the raised surface while its radio is checked, and its panel
 * reveals through the stage's `:has()` rule.
 *
 * @param handle Runtime handle carrying the tab's props.
 * @returns The render function producing the radio and its label.
 */
function TabControl(handle: Handle<TabControlProps>) {
	return () => {
		let { defaultChecked, inputId, name, tab, value, variant } = handle.props;
		let isCode = variant === "code";
		return (
			<>
				<input
					type="radio"
					name={name}
					id={inputId}
					value={value}
					defaultChecked={defaultChecked}
					mix={[visuallyHidden()]}
				/>
				<label
					htmlFor={inputId}
					data-slot="code-stage-tab"
					mix={[
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.375rem",
							paddingBlock: "0.25rem",
							paddingInline: "0.625rem",
							borderRadius: "0.375rem",
							fontSize: "0.875rem",
							lineHeight: "1.25rem",
							fontWeight: 500,
							cursor: "pointer",
							whiteSpace: "nowrap",
							color: isCode
								? "var(--ui-neutral-fg, color-mix(in oklab, currentColor 70%, transparent))"
								: "color-mix(in oklab, currentColor 70%, transparent)",
						}),
						when(
							":is(input:checked) + &",
							raw(
								isCode
									? {
											backgroundColor: "var(--ui-surface-raised, Canvas)",
											boxShadow:
												"0 0 0 1px var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))",
											color: "var(--ui-neutral-fg-emphasis, CanvasText)",
										}
									: {
											backgroundColor: "color-mix(in oklab, currentColor 14%, transparent)",
											color: "inherit",
										},
							),
						),
						when(
							":is(input:focus-visible) + &",
							raw({
								outline: "2px solid var(--ui-brand-ring, Highlight)",
								outlineOffset: "-2px",
							}),
						),
					]}
				>
					{tab.icon ? (
						<span aria-hidden="true" mix={[raw({ display: "inline-flex" })]}>
							{tab.icon}
						</span>
					) : null}
					{tab.label}
				</label>
			</>
		);
	};
}

/**
 * Props accepted by {@link CodeBody}.
 */
interface CodeBodyProps extends TagProps<"pre"> {
	variant: CodeStage.Variant;
	lineCount: number | null;
}

/**
 * The mono `pre` one file renders into: it scrolls sideways inside the panel and,
 * when numbered, counts each `[data-line]` into a gutter whose numbers sit at
 * 60% ink behind a hairline.
 *
 * @param handle Runtime handle carrying the body's props.
 * @returns The render function producing the `pre`.
 */
function CodeBody(handle: Handle<CodeBodyProps>) {
	return () => {
		let { children, lineCount, mix, variant, ...rest } = handle.props;
		let numbered = lineCount !== null;
		return (
			<pre
				{...rest}
				data-line-numbers={numbered ? "true" : undefined}
				mix={[
					m(0),
					raw({ paddingBlock: "1rem", paddingInline: `${INSET} 1rem`, minInlineSize: 0 }),
					font("mono"),
					overflowX("auto"),
					bodySurface(variant),
					numbered ? gutterRules(variant) : [],
					mix,
				]}
			>
				{children}
			</pre>
		);
	};
}

/**
 * The gutter width a numbered body declares: digits for the longest number plus
 * 1ch of padding, the 1px hairline and 1ch before the code. Resolved in the mono
 * face wherever it is read, so the header can start its title on the code column.
 *
 * @param lineCount Lines the body numbers; 10 or more widens every number alike.
 * @returns The custom property declaration.
 */
function gutterProperty(lineCount: number) {
	let digits = Math.max(2, String(lineCount).length);
	return { "--ui-code-stage-gutter": `calc(${digits}ch + 2ch + 1px)` };
}

/**
 * Counter rules for a numbered body. Each line's number is an inline-block of its
 * own and the code an inline-block beside it, so tab stops count from the code
 * column and a leading tab indents a full tab width.
 *
 * @param variant Resolved surface treatment, which picks the hairline.
 * @returns The mixins the numbered `pre` applies.
 */
function gutterRules(variant: CodeStage.Variant) {
	return [
		raw({ counterReset: "line" }),
		when("& > [data-line]", raw({ counterIncrement: "line" })),
		when("& > [data-line] > [data-code]", raw({ display: "inline-block", verticalAlign: "top" })),
		when(
			"& > [data-line]::before",
			raw({
				content: "counter(line)",
				display: "inline-block",
				verticalAlign: "top",
				boxSizing: "content-box",
				inlineSize: "calc(var(--ui-code-stage-gutter) - 2ch - 1px)",
				paddingInlineEnd: "1ch",
				marginInlineEnd: "1ch",
				borderInlineEnd: `1px solid ${
					variant === "code"
						? "var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))"
						: "color-mix(in oklab, currentColor 18%, transparent)"
				}`,
				textAlign: "end",
				color: GUTTER_INK,
				userSelect: "none",
			}),
		),
	];
}

/**
 * The header's chrome for a variant: one 40px height with symmetric block
 * padding so its content centres, the code's inline start, and a rule under it
 * on every panel but an untabbed slab.
 *
 * @param variant Resolved surface treatment.
 * @param hasTabs Whether the header holds a tab strip, which tints it on a card.
 * @returns The mixins the header applies.
 */
function headerChrome(variant: CodeStage.Variant, hasTabs: boolean) {
	let rule =
		variant === "code"
			? "var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))"
			: "color-mix(in oklab, currentColor 18%, transparent)";
	return [
		hstack({ gap: 2, align: "center", justify: "between" }),
		raw({
			boxSizing: "border-box",
			blockSize: HEADER_HEIGHT,
			flexShrink: 0,
			paddingBlock: 0,
			paddingInline: hasTabs ? `calc(${INSET} - 0.625rem) 0.5rem` : `${INSET} 0.5rem`,
			minInlineSize: 0,
		}),
		variant === "slab" && !hasTabs ? [] : raw({ borderBlockEnd: `1px solid ${rule}` }),
		variant === "code" && hasTabs
			? raw({
					backgroundColor: "color-mix(in oklch, CanvasText 3%, transparent)",
					borderStartStartRadius: "inherit",
					borderStartEndRadius: "inherit",
				})
			: [],
	];
}

/**
 * The host's surface for a variant, emitted as one rule so no two mixins race
 * for the same property: the raised marketing surface for `code`, a bordered
 * dark panel for `terminal`, and a 4px-padded slab dark in both schemes. The
 * dark panels re-point the token colors at the palette that reads on them.
 *
 * @param variant Resolved surface treatment.
 * @returns The mixins the host applies.
 */
function hostSurface(variant: CodeStage.Variant) {
	if (variant === "terminal") {
		return [
			raw({ borderRadius: FRAME_RADIUS }),
			border({ color: "neutral", width: 1, style: "solid" }),
			raw({
				...TERMINAL_TOKENS,
				backgroundColor: "color-mix(in oklab, CanvasText 92%, Canvas)",
				color: "Canvas",
			}),
		];
	}
	if (variant === "slab") {
		return [
			raw({
				...SLAB_TOKENS,
				padding: "4px",
				borderRadius: FRAME_RADIUS,
				backgroundColor: "oklch(0.18 0.005 260)",
				color: SLAB_INK,
				colorScheme: "dark",
			}),
		];
	}
	return [marketingSurface()];
}

/**
 * The `pre`'s type, ink and sheet for a variant. Every variant keeps lines
 * whole (`white-space: pre`) and scrolls sideways; code and terminal set 13px at
 * 1.6, and the slab's white/8 sheet inside a white/10 ring sets 13px on 24px.
 *
 * @param variant Resolved surface treatment.
 * @returns The mixin the `pre` applies.
 */
function bodySurface(variant: CodeStage.Variant) {
	let common = { overscrollBehaviorInline: "contain", whiteSpace: "pre", tabSize: "4" };

	if (variant === "slab") {
		return raw({
			...common,
			fontSize: CODE_FONT_SIZE,
			lineHeight: "1.5rem",
			color: SLAB_INK,
			backgroundColor: "rgb(255 255 255 / 0.08)",
			boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.1)",
			borderRadius: `calc(${FRAME_RADIUS} - 4px)`,
		});
	}
	return raw({
		...common,
		fontSize: CODE_FONT_SIZE,
		lineHeight: 1.6,
		color: variant === "terminal" ? "Canvas" : "var(--ui-neutral-fg-emphasis, CanvasText)",
	});
}

/**
 * Turns a stage's content into `pre` children: a string highlights when a
 * language is named and, when numbered, splits into one `[data-line]` per line
 * holding that line's tokens. Newlines stay between the lines so copied text
 * keeps its shape, and a single trailing newline never numbers an empty line.
 *
 * @param content The stage's or tab's content.
 * @param language Language to highlight as, if any.
 * @param lineNumbers Whether to number the lines.
 * @returns The children to render and how many lines were numbered.
 */
function paint(content: RemixNode, language: string | undefined, lineNumbers: boolean): Painted {
	let source = textOf(content);
	if (source === null) return { nodes: content, lineCount: null };
	if (!lineNumbers) {
		return { nodes: language ? renderRuns(tokenize(source, language)) : content, lineCount: null };
	}

	let trimmed = source.replace(/\r?\n$/, "");
	let runs = language ? tokenize(trimmed, language) : [{ type: "plain" as const, value: trimmed }];
	let lines = splitLines(runs);
	let nodes: RemixNode[] = [];
	for (let [index, line] of lines.entries()) {
		if (index > 0) nodes.push("\n");
		nodes.push(
			<span data-line="">
				<span data-code="">{renderRuns(line)}</span>
			</span>,
		);
	}
	return { nodes, lineCount: lines.length };
}

/**
 * Splits tokens at newlines so each line owns its tokens; a token spanning lines
 * (a block comment, a template literal) becomes one token per line, same type.
 *
 * @param runs Tokens covering the source once, in order.
 * @returns One token list per source line.
 */
function splitLines(runs: Token[]): Token[][] {
	let lines: Token[][] = [[]];
	for (let run of runs) {
		for (let [index, piece] of run.value.split(/\r?\n/).entries()) {
			if (index > 0) lines.push([]);
			if (piece.length > 0) lines[lines.length - 1]?.push({ type: run.type, value: piece });
		}
	}
	return lines;
}

/**
 * Renders tokens as text and `span.token.<type>` elements, the class contract the
 * shared highlight stylesheet colors. Each span also carries its color as
 * `var(--highlight-<type>)` with a scheme-aware fallback, so code reads in color
 * on a page that never loaded that stylesheet.
 *
 * @param runs Tokens to render.
 * @returns The rendered nodes.
 */
function renderRuns(runs: Token[]): RemixNode[] {
	return runs.map((run) => {
		if (run.type === "plain") return run.value;
		let [light, dark] = TOKEN_PALETTE[run.type];
		return (
			<span
				className={`token ${run.type}`}
				mix={[raw({ color: `var(--highlight-${run.type}, light-dark(${light}, ${dark}))` })]}
			>
				{run.value}
			</span>
		);
	});
}

/**
 * Reads children as plain text: a string, or an array made only of strings
 * (what JSX produces for adjacent text and string expressions).
 *
 * @param children The stage's children.
 * @returns The joined text, or `null` when any child is an element.
 */
function textOf(children: RemixNode): string | null {
	if (typeof children === "string") return children;
	if (Array.isArray(children) && children.every((child) => typeof child === "string")) {
		return children.join("");
	}
	return null;
}

/**
 * Alias for {@link CodeStage} with terminal chrome — same props, same host.
 * Prefer this name when the sample is a shell session rather than a file.
 */
export const TerminalPanel = CodeStage;
