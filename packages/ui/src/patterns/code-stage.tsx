/**
 * A titled mono panel for install samples, CLI output, or code snippets on a
 * landing. The optional actions slot holds a copy control the page supplies;
 * the library never invents a clipboard button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { overflowX } from "@sdxc/u/overflow";
import { m, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text, weight } from "@sdxc/u/typography";

import { marketingSurface } from "../styles/marketing.js";

/** Panel chrome {@link CodeStage} applies when `variant` is omitted. */
const DEFAULT_VARIANT: CodeStage.Variant = "code";

/** Light ink a slab sets its code in, readable on the slab in both schemes. */
const SLAB_INK = "oklch(0.93 0 0)";

/** Header text and rules on the dark terminal panel, derived from the page canvas. */
const TERMINAL_MUTED = "color-mix(in oklab, Canvas 70%, transparent)";

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
	 * Per-part styling for chrome the stage renders besides its host.
	 */
	export interface PartsProps {
		/** Styling for the optional title bar. */
		header?: TagProps<"div">["mix"];
		/** Styling for the mono body that wraps children. */
		body?: TagProps<"pre">["mix"];
	}

	/**
	 * Props accepted by {@link CodeStage}.
	 */
	export interface Props extends Omit<TagProps<"div">, "title"> {
		/** Surface treatment. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** Optional title or path shown in the header. */
		title?: RemixNode;
		/** Optional trailing control in the header — typically a copy button. */
		actions?: RemixNode;
		/**
		 * Numbers each line in the gutter at 40% ink. Numbering reads lines from a
		 * string child; any other child renders unnumbered.
		 */
		lineNumbers?: boolean;
		/** Per-part styling for header and body. */
		parts?: PartsProps;
		/** Mono body content — a command, snippet, or terminal output. */
		children: RemixNode;
	}
}

/**
 * Renders an optional titled header and a mono body that keeps every line
 * intact and scrolls sideways when a line outgrows the panel. Prefer
 * `variant="terminal"` when the sample should read as a shell session.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the stage's markup.
 * @example
 * <CodeStage title="install.sh" actions={copyControl}>
 * 	{t("install.command")}
 * </CodeStage>
 * @example
 * <CodeStage variant="slab" lineNumbers>{snippet}</CodeStage>
 */
export function CodeStage(handle: Handle<CodeStage.Props>) {
	return () => {
		let { actions, children, lineNumbers, mix, parts, title, variant, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;
		let isTerminal = resolvedVariant === "terminal";
		let isSlab = resolvedVariant === "slab";
		let showHeader = title !== undefined || actions !== undefined;
		let numbered = lineNumbers ? numberLines(children) : null;

		return (
			<div
				{...rest}
				data-slot="code-stage"
				data-variant={resolvedVariant}
				mix={[vstack({ gap: 0, align: "stretch" }), hostSurface(resolvedVariant), mix]}
			>
				{showHeader ? (
					<div
						mix={[
							hstack({ gap: 2, align: "center", justify: "between" }),
							isSlab ? p(1.5, 2, 2, 3) : p(2, 2, 2, 3),
							isSlab
								? []
								: raw({
										borderBlockEnd: isTerminal
											? "1px solid color-mix(in oklab, Canvas 18%, transparent)"
											: "1px solid var(--ui-marketing-hairline, var(--ui-neutral-border))",
									}),
							parts?.header,
						]}
					>
						{title ? (
							<span
								mix={[
									font("mono"),
									text("sm"),
									weight("medium"),
									isTerminal || isSlab
										? raw({ color: isSlab ? "rgb(255 255 255 / 0.6)" : TERMINAL_MUTED })
										: fg("neutral"),
								]}
							>
								{title}
							</span>
						) : (
							<span />
						)}
						{actions}
					</div>
				) : null}

				<pre
					data-line-numbers={numbered ? "true" : undefined}
					mix={[
						m(0),
						p(4),
						font("mono"),
						overflowX("auto"),
						bodySurface(resolvedVariant),
						numbered
							? [
									raw({ counterReset: "line" }),
									when("& > [data-line]", raw({ counterIncrement: "line" })),
									when(
										"& > [data-line]::before",
										raw({
											content: "counter(line)",
											display: "inline-block",
											minInlineSize: "2ch",
											marginInlineEnd: "1.5ch",
											textAlign: "end",
											color: "color-mix(in oklch, currentColor 40%, transparent)",
											userSelect: "none",
										}),
									),
								]
							: [],
						parts?.body,
					]}
				>
					{numbered ?? children}
				</pre>
			</div>
		);
	};
}

/**
 * The host's surface for a variant, emitted as one rule so no two mixins race
 * for the same property: the raised marketing surface for `code`, a bordered
 * dark panel for `terminal`, and a 4px-padded slab dark in both schemes.
 *
 * @param variant Resolved surface treatment.
 * @returns The mixins the host applies.
 */
function hostSurface(variant: CodeStage.Variant) {
	if (variant === "terminal") {
		return [
			rounded("lg"),
			border({ color: "neutral", width: 1, style: "solid" }),
			raw({ backgroundColor: "color-mix(in oklab, CanvasText 92%, Canvas)", color: "Canvas" }),
		];
	}
	if (variant === "slab") {
		return [
			raw({
				padding: "4px",
				borderRadius: "0.75rem",
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
 * whole (`white-space: pre`) and scrolls sideways; the slab's sheet is a
 * white/8 fill inside a white/10 ring, set at 13px/24px.
 *
 * @param variant Resolved surface treatment.
 * @returns The mixin the `pre` applies.
 */
function bodySurface(variant: CodeStage.Variant) {
	let common = { overscrollBehaviorInline: "contain", whiteSpace: "pre" };

	if (variant === "slab") {
		return raw({
			...common,
			fontSize: "0.8125rem",
			lineHeight: "1.5rem",
			color: SLAB_INK,
			backgroundColor: "rgb(255 255 255 / 0.08)",
			boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.1)",
			borderRadius: "0.5rem",
		});
	}
	return [
		text("sm"),
		raw({ ...common, color: variant === "terminal" ? "Canvas" : "var(--ui-neutral-fg-emphasis)" }),
	];
}

/**
 * Splits a string child into one `[data-line]` span per line so CSS counters can
 * number them; the newlines stay between the spans so copied text keeps its
 * shape. A single trailing newline is dropped so it never numbers an empty line.
 *
 * @param children The stage's children.
 * @returns The numbered lines, or `null` when the children are not text.
 */
function numberLines(children: RemixNode): RemixNode[] | null {
	let source = textOf(children);
	if (source === null) return null;

	let lines = source.replace(/\r?\n$/, "").split(/\r?\n/);
	let nodes: RemixNode[] = [];
	for (let [index, line] of lines.entries()) {
		if (index > 0) nodes.push("\n");
		nodes.push(<span data-line="">{line}</span>);
	}
	return nodes;
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
