/**
 * A titled code card for documentation: the file it belongs to (with an icon for its
 * kind) or "Terminal", highlighted, added and removed lines, optional line numbers, and a
 * copy button that copies what a reader should paste — no `$` prompts, no output lines.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { tokenize } from "@sdxc/highlight";
import {
	FileBracesIcon,
	FileCodeIcon,
	FileCogIcon,
	FileIcon,
	FileTextIcon,
	TerminalIcon,
} from "@sdxc/icons";
import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { mergeMix, raw } from "@sdxc/u/general";
import { absolute, hstack, inlineFlex, insBs, insIe, relative, shrink } from "@sdxc/u/layout";
import { overflowX } from "@sdxc/u/overflow";
import { bs, m, minIs, pi } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { font, text, truncate } from "@sdxc/u/typography";

import { COPY_EXCLUDE_ATTRIBUTE } from "../mixins/copy-to-clipboard.js";

import { CopyButton } from "./copy-button.js";

/** Inline padding of every line, which a marked line splits between its bar and its text. */
const LINE_INSET = "1rem";

/** Width of the bar a marked line draws on its inline-start edge. */
const MARK_BAR = "2px";

/** Languages whose blocks are shell sessions: a `$ ` prompt marks a command, not code. */
const SHELL_LANGUAGES = new Set(["sh", "bash", "shell", "zsh", "fish", "console", "terminal"]);

/** The prompt a shell block draws before each command, outside the copied text. */
const PROMPT = "$ ";

/**
 * Token colors as `[light, dark]` pairs, the GitHub palettes the shared highlight
 * stylesheet ships, used when the page declares no `--highlight-*` property of its own.
 */
const TOKEN_PALETTE: Record<string, readonly [string, string]> = {
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

/** FNV-1a offset basis, the starting state of the hash that names a block's code. */
const FNV_OFFSET = 0x811c9dc5;

/** FNV-1a prime, which spreads each character through the hash. */
const FNV_PRIME = 0x01000193;

/**
 * Prop types for {@link CodeBlock}.
 */
export namespace CodeBlock {
	/**
	 * One painted run of source. Structural, so the runs a Markdown pipeline already
	 * painted with `@sdxc/highlight` pass straight through.
	 */
	export interface Token {
		type: string;
		value: string;
	}

	/** The copy button's strings; the library ships no copy of its own. */
	export interface Labels {
		/** The button's accessible name, such as "Copy code". */
		copy: string;
		/** What a screen reader announces after a copy, such as "Copied". */
		copied: string;
	}

	/** How a line is marked: a changed line to look at, or a line a diff adds or removes. */
	export type Mark = "highlight" | "add" | "remove";

	/**
	 * Props accepted by {@link CodeBlock}. Line numbers in `highlight`, `add` and `remove`
	 * count from 1, the way prose refers to them.
	 */
	export interface Props extends Omit<TagProps<"figure">, "title" | "children"> {
		/** The source as written; a single trailing newline is dropped. */
		code: string;
		/** Language the code highlights as, named the way a fence names it (`ts`, `sh`). */
		language?: string;
		/** Runs already painted for `code`, which skip highlighting here. */
		tokens?: readonly Token[];
		/**
		 * What the header reads as: a file path draws an icon for its kind, and anything
		 * else (such as "Terminal") reads as written. Without one the header names the
		 * language, and a block with neither floats its copy button over the code.
		 */
		title?: string;
		highlight?: readonly number[];
		add?: readonly number[];
		/** Lines a diff removes; they stay on screen and stay off the clipboard. */
		remove?: readonly number[];
		/** Numbers each line in a gutter, for long listings prose refers to by line. */
		lineNumbers?: boolean;
		labels: Labels;
		/**
		 * The `id` of the `<code>` element the copy button targets. Defaults to one derived
		 * from the code, which stays the same on every render of the same block.
		 */
		codeId?: string;
	}
}

/** One source line as the block draws it. */
interface Line {
	tokens: CodeBlock.Token[];
	mark: CodeBlock.Mark | undefined;
	/** Whether the line is a shell command drawn after a prompt. */
	prompt: boolean;
	/** Whether the line is shell output, which stays off the clipboard. */
	output: boolean;
}

/**
 * Renders the card: a header naming the file (or the language) with the copy button, and
 * the code, which scrolls sideways inside the card. Marked lines tint across the full
 * scroll width with a 2px bar whose width comes out of the line's padding, so no text moves.
 *
 * @param handle Runtime handle carrying the block's props.
 * @returns The render function producing the card.
 * @example
 * <CodeBlock title="vite.config.ts" language="ts" code={source} highlight={[4, 5]} labels={{ copy: t("copy"), copied: t("copied") }} />
 * @example
 * <CodeBlock title="Terminal" language="sh" code={"$ npm add @sdxc/ui\n$ npm run dev"} labels={labels} />
 */
export function CodeBlock(handle: Handle<CodeBlock.Props>) {
	return () => {
		let {
			add,
			code,
			codeId,
			highlight,
			labels,
			language,
			lineNumbers = false,
			mix,
			remove,
			title,
			tokens,
			...rest
		} = handle.props;

		let shell = isShell(language, title);
		let lines = paintLines(code, language, tokens, shell, { add, highlight, remove });
		let id = codeId ?? stableId(code);
		let heading = title ?? (language && language !== "plain" ? language : undefined);
		let copy = <CopyButton target={id} label={labels.copy} copiedLabel={labels.copied} />;
		let digits = Math.max(2, String(lines.length).length);

		return (
			<figure
				{...rest}
				data-slot="code-block"
				data-language={language}
				mix={mergeMix(
					[
						relative(),
						m(0),
						minIs(0),
						rounded("lg"),
						border({ color: "neutral.border", width: 1, style: "solid" }),
						bg("neutral.bg-tint"),
						raw({ overflow: "hidden" }),
					],
					mix,
				)}
			>
				{heading ? (
					<figcaption
						mix={[
							hstack({ gap: 2, align: "center", justify: "between" }),
							bs("2.5rem"),
							pi(4, 1),
							borderEdge("block-end", { color: "neutral.border", width: 1, style: "solid" }),
						]}
					>
						<span mix={[hstack({ gap: 2, align: "center" }), minIs(0), fg("neutral")]}>
							<span data-slot="code-block-icon" mix={[inlineFlex(), shrink(0)]}>
								<TitleIcon title={title} shell={shell} />
							</span>
							<span
								mix={[minIs(0), truncate(), title && isPath(title) ? font("mono") : [], text("xs")]}
							>
								{heading}
							</span>
						</span>
						{copy}
					</figcaption>
				) : (
					<span mix={[absolute(), insBs("0.375rem"), insIe("0.375rem"), z(1)]}>{copy}</span>
				)}

				<pre
					data-not-typeset=""
					data-line-numbers={lineNumbers ? "" : undefined}
					mix={[
						m(0),
						overflowX("auto"),
						fg("neutral.emphasis"),
						font("mono"),
						raw({
							paddingBlock: "0.875rem",
							paddingInline: 0,
							border: 0,
							borderRadius: 0,
							background: "transparent",
							fontSize: "0.8125rem",
							lineHeight: 1.7,
							whiteSpace: "pre",
							tabSize: 4,
							overscrollBehaviorInline: "contain",
						}),
					]}
				>
					<code
						id={id}
						className={language ? `language-${language}` : undefined}
						mix={[lineRules(Boolean(heading), lineNumbers, digits)]}
					>
						{renderLines(lines)}
					</code>
				</pre>
			</figure>
		);
	};
}

/**
 * Every rule the lines follow, in one block so a marked line's padding, bar and tint
 * resolve by specificity alone. The grid makes each line as wide as the longest one, so a
 * tint runs the full scroll width, and drops the newlines between lines from layout while
 * leaving them in the text a copy reads.
 *
 * @param hasHeader Whether the copy button sits in a header rather than over the code.
 * @param lineNumbers Whether lines draw a gutter number.
 * @param digits Digits the widest line number needs.
 */
function lineRules(hasHeader: boolean, lineNumbers: boolean, digits: number) {
	let markedInset = `calc(${LINE_INSET} - ${MARK_BAR})`;
	let tint = (tone: string) => `color-mix(in oklab, var(--ui-${tone}-fg) 12%, transparent)`;

	return raw({
		display: "grid",
		minInlineSize: "100%",
		inlineSize: "max-content",
		counterReset: "line",
		font: "inherit",
		background: "transparent",
		padding: 0,
		"& > [data-line]": {
			position: "relative",
			minBlockSize: "1lh",
			paddingInlineStart: LINE_INSET,
			paddingInlineEnd: hasHeader ? LINE_INSET : "3rem",
			counterIncrement: "line",
		},
		"& > [data-mark]": {
			paddingInlineStart: markedInset,
			borderInlineStartWidth: MARK_BAR,
			borderInlineStartStyle: "solid",
		},
		'& > [data-mark="highlight"]': {
			backgroundColor: tint("brand"),
			borderInlineStartColor: `var(--ui-brand-fg)`,
		},
		'& > [data-mark="add"]': {
			backgroundColor: tint("success"),
			borderInlineStartColor: `var(--ui-success-fg)`,
		},
		'& > [data-mark="remove"]': {
			backgroundColor: tint("danger"),
			borderInlineStartColor: `var(--ui-danger-fg)`,
		},
		'& > [data-mark="add"]::after, & > [data-mark="remove"]::after': {
			position: "absolute",
			insetInlineStart: "0.3rem",
			userSelect: "none",
			color: "var(--ui-neutral-fg-muted)",
		},
		'& > [data-mark="add"]::after': { content: '"+"' },
		'& > [data-mark="remove"]::after': { content: '"-"' },
		"& > [data-output]": { color: "var(--ui-neutral-fg-muted)" },
		"& [data-prompt]::before": {
			content: `"${PROMPT}"`,
			userSelect: "none",
			color: "var(--ui-neutral-fg-muted)",
		},
		...(lineNumbers
			? {
					"& > [data-line]::before": {
						content: "counter(line)",
						display: "inline-block",
						inlineSize: `${digits}ch`,
						marginInlineEnd: "1.5ch",
						textAlign: "end",
						userSelect: "none",
						color: "var(--ui-neutral-fg-muted)",
					},
				}
			: {}),
	});
}

/** Props for {@link TitleIcon}. */
interface TitleIconProps {
	title: string | undefined;
	shell: boolean;
}

/**
 * The glyph before the header text: a terminal for a shell session, otherwise a file
 * glyph picked by the title's extension, so a reader sees what kind of file it is.
 */
function TitleIcon(handle: Handle<TitleIconProps>) {
	return () => {
		let { shell, title } = handle.props;
		let extension = title?.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();

		if (shell && !extension) return <TerminalIcon size={14} aria-hidden="true" />;
		if (extension === "json" || extension === "jsonc") {
			return <FileBracesIcon size={14} aria-hidden="true" />;
		}
		if (extension && ["md", "mdx", "txt"].includes(extension)) {
			return <FileTextIcon size={14} aria-hidden="true" />;
		}
		if (extension && ["toml", "yaml", "yml", "env", "ini"].includes(extension)) {
			return <FileCogIcon size={14} aria-hidden="true" />;
		}
		if (extension) return <FileCodeIcon size={14} aria-hidden="true" />;
		return <FileIcon size={14} aria-hidden="true" />;
	};
}

/** Whether a title names a file, which sets it in the mono face. */
function isPath(title: string): boolean {
	return /[/.]/.test(title) && !/\s/.test(title);
}

/** Whether the block is a shell session, by its language or a "Terminal" title. */
function isShell(language: string | undefined, title: string | undefined): boolean {
	if (language && SHELL_LANGUAGES.has(language.toLowerCase())) return true;
	return title?.trim().toLowerCase() === "terminal";
}

/**
 * Splits the code into lines, each holding its runs and its mark. In a shell block a
 * line opening with `$ ` loses the prompt, which the line draws as decoration instead,
 * and once any line has a prompt the lines that are neither commands nor a continued
 * command (after a trailing `\`) read as output.
 */
function paintLines(
	code: string,
	language: string | undefined,
	tokens: readonly CodeBlock.Token[] | undefined,
	shell: boolean,
	marks: Pick<CodeBlock.Props, "add" | "highlight" | "remove">,
): Line[] {
	let source = code.replace(/\r?\n$/, "");
	let rawLines = source.split(/\r?\n/);
	let prompts = rawLines.map((line) => shell && line.startsWith(PROMPT));
	let hasPrompts = prompts.some(Boolean);
	let stripped = rawLines.map((line, index) => (prompts[index] ? line.slice(PROMPT.length) : line));

	let text = hasPrompts ? stripped.join("\n") : source;
	let runs: readonly CodeBlock.Token[] =
		tokens ?? (language ? tokenize(text, language) : [{ type: "plain", value: text }]);

	let lines: Line[] = [];
	let continued = false;

	for (let [index, lineTokens] of splitLines(runs).slice(0, rawLines.length).entries()) {
		let prompt = prompts[index] ?? false;
		let command: boolean = prompt || continued;
		continued = command && (rawLines[index] ?? "").endsWith("\\");
		lines.push({
			tokens: tokens && prompt ? dropLeading(lineTokens, PROMPT.length) : lineTokens,
			mark: markOf(index + 1, marks),
			prompt,
			output: hasPrompts && !command,
		});
	}

	return lines;
}

/** The mark a line carries; a removal or addition wins over a plain highlight. */
function markOf(
	number: number,
	marks: Pick<CodeBlock.Props, "add" | "highlight" | "remove">,
): CodeBlock.Mark | undefined {
	if (marks.remove?.includes(number)) return "remove";
	if (marks.add?.includes(number)) return "add";
	if (marks.highlight?.includes(number)) return "highlight";
	return undefined;
}

/**
 * Splits runs at newlines so each line owns its runs; a run spanning lines (a block
 * comment, a template literal) becomes one run per line, same type.
 */
function splitLines(runs: readonly CodeBlock.Token[]): CodeBlock.Token[][] {
	let lines: CodeBlock.Token[][] = [[]];
	for (let run of runs) {
		for (let [index, piece] of run.value.split(/\r?\n/).entries()) {
			if (index > 0) lines.push([]);
			if (piece.length > 0) lines[lines.length - 1]?.push({ type: run.type, value: piece });
		}
	}
	return lines;
}

/** Drops the first `count` characters of a line's runs, for a prompt already painted in. */
function dropLeading(runs: CodeBlock.Token[], count: number): CodeBlock.Token[] {
	let remaining = count;
	let result: CodeBlock.Token[] = [];
	for (let run of runs) {
		if (remaining >= run.value.length) {
			remaining -= run.value.length;
			continue;
		}
		result.push({ type: run.type, value: run.value.slice(remaining) });
		remaining = 0;
	}
	return result;
}

/**
 * Draws every line with a newline between each pair, so the text a copy reads keeps the
 * source's shape. Output and removed lines carry the attribute that keeps them off the
 * clipboard.
 */
function renderLines(lines: Line[]): RemixNode[] {
	let nodes: RemixNode[] = [];
	for (let [index, line] of lines.entries()) {
		if (index > 0) nodes.push("\n");
		let excluded = line.output || line.mark === "remove";
		nodes.push(
			<span
				data-line=""
				data-mark={line.mark}
				data-output={line.output ? "" : undefined}
				{...(excluded ? { [COPY_EXCLUDE_ATTRIBUTE]: "" } : {})}
			>
				{line.prompt ? <span data-prompt="" /> : null}
				{renderRuns(line.tokens)}
			</span>,
		);
	}
	return nodes;
}

/**
 * Renders runs as text and `span.token.<type>` elements, the class contract the shared
 * highlight stylesheet colors; each span also carries its color with a scheme-aware
 * fallback, so code reads in color on a page that never loaded that stylesheet.
 */
function renderRuns(runs: CodeBlock.Token[]): RemixNode[] {
	return runs.map((run) => {
		let palette = TOKEN_PALETTE[run.type];
		if (run.type === "plain" || !palette) return run.value;
		let [light, dark] = palette;
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
 * An element id derived from the code. A documentation page is cached against the bytes
 * it rendered, so an id that changed per render would cost a fresh download.
 */
function stableId(value: string): string {
	let hash = FNV_OFFSET;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, FNV_PRIME);
	}
	return `code-${(hash >>> 0).toString(36)}`;
}
