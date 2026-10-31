/**
 * The components a documentation page renders its markdown through: fenced code as a
 * bordered card headed by its title (or language) with a copy button, and GitHub-style
 * `> [!KIND]` alerts as tinted asides. Built per request so every label is translated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixOptions } from "@sdxc/markdown/remix";
import type { Handle, RemixNode } from "remix/component";

import {
	FileCodeIcon,
	InfoIcon,
	LightbulbIcon,
	MessageSquareWarningIcon,
	OctagonAlertIcon,
	TerminalIcon,
	TriangleAlertIcon,
} from "@sdxc/icons";
import { bg, border, borderEdge, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hstack, inlineFlex, shrink, vstack } from "@sdxc/u/layout";
import { overflowX } from "@sdxc/u/overflow";
import { bs, m, mb, minIs, p, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text, textTransform, tracking, truncate, weight } from "@sdxc/u/typography";
import { semanticColorPanel } from "@sdxc/ui/styles";

import { DocsCopyButton } from "~/resources/components/docs-copy-button";

/** The language a fence left unnamed, so the highlighter's stylesheet still has a class to match. */
const PLAIN_LANGUAGE = "plain";

/** Languages a reader types into a shell, which the header marks with a terminal glyph. */
const SHELL_LANGUAGES = new Set(["bash", "sh", "shell", "zsh", "console"]);

/** FNV-1a offset basis and prime, which give a short id with few collisions. */
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** The five kinds GitHub's alert syntax names, from adding a fact to warning of a loss. */
type AlertKind = "note" | "tip" | "important" | "warning" | "caution";

/** Every translated string the markdown components draw. */
export interface DocsMarkdownLabels {
	copy: string;
	copied: string;
	alerts: Record<AlertKind, string>;
}

/**
 * The tint and glyph each alert kind draws with, so every kind reads apart by shape as
 * well as colour. The tints are the semantic scales, which carry Uptime's own palette.
 */
const ALERT_KINDS: Record<AlertKind, { color: string; Glyph: typeof InfoIcon }> = {
	note: { color: "brand", Glyph: InfoIcon },
	tip: { color: "success", Glyph: LightbulbIcon },
	important: { color: "neutral", Glyph: MessageSquareWarningIcon },
	warning: { color: "warning", Glyph: TriangleAlertIcon },
	caution: { color: "danger", Glyph: OctagonAlertIcon },
};

/** One painted run of source, structural so any painter's output renders here. */
interface Token {
	type: string;
	value: string;
}

/** The props a fenced code node arrives with: its fields plus the annotation's attributes. */
interface CodeProps {
	content: string;
	language?: string;
	tokens?: unknown;
	/** What the header reads as; the path wins when the fence wrote both. */
	title?: string;
	path?: string;
	children?: RemixNode;
}

/** The props an alert node arrives with. */
interface AlertProps {
	kind?: unknown;
	children?: RemixNode;
}

/**
 * An element id derived from the code it names, so a page renders byte-identical HTML on
 * every request and a prefetched copy matches the navigation.
 */
function stableId(prefix: string, value: string): string {
	let hash = FNV_OFFSET_BASIS;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, FNV_PRIME);
	}
	return `${prefix}-${(hash >>> 0).toString(36)}`;
}

/** Guards each run, so a malformed field falls back to the raw source. */
function isToken(value: unknown): value is Token {
	if (typeof value !== "object" || value === null) return false;
	let candidate = value as { type?: unknown; value?: unknown };
	return typeof candidate.type === "string" && typeof candidate.value === "string";
}

/** Narrows the parsed kind, so a kind the table lacks still draws as a note. */
function isAlertKind(kind: unknown): kind is AlertKind {
	return typeof kind === "string" && kind in ALERT_KINDS;
}

/**
 * Builds the component map for `toRemix` with the reader's labels baked in.
 *
 * @param labels - The copy button's and the alerts' translated labels
 * @returns Components keyed by the markdown node they draw
 * @example toRemix(document, { components: docsMarkdownComponents(labels) })
 */
export function docsMarkdownComponents(
	labels: DocsMarkdownLabels,
): NonNullable<RemixOptions["components"]> {
	/**
	 * Draws one fenced block as a card: a header naming the file or language with the copy
	 * button at its end, over code that scrolls sideways inside the card so a long line
	 * never widens the page.
	 */
	function DocsCode(handle: Handle<CodeProps>) {
		return () => {
			let { content, language = PLAIN_LANGUAGE, path, title, tokens } = handle.props;
			let heading = path ?? title ?? (language === PLAIN_LANGUAGE ? "" : language);
			let codeId = stableId("code", content);
			let runs = Array.isArray(tokens) ? tokens.filter(isToken) : [];
			let Glyph = SHELL_LANGUAGES.has(language) && !path && !title ? TerminalIcon : FileCodeIcon;

			return (
				<figure
					data-slot="docs-code"
					mix={[
						m("1.5rem", 0),
						rounded("lg"),
						border({ color: "neutral.border", width: 1, style: "solid" }),
						bg("neutral.bg-tint"),
						raw({ overflow: "hidden" }),
					]}
				>
					<figcaption
						mix={[
							hstack({ gap: 2, align: "center", justify: "between" }),
							bs("2.5rem"),
							pi(4, 1.5),
							borderEdge("block-end", { color: "neutral.border", width: 1, style: "solid" }),
						]}
					>
						<span mix={[hstack({ gap: 2, align: "center" }), minIs(0), fg("neutral")]}>
							<span mix={[inlineFlex(), shrink(0)]}>
								<Glyph size={14} aria-hidden="true" />
							</span>
							<span mix={[minIs(0), truncate(), font("mono"), text("xs")]}>{heading}</span>
						</span>
						<DocsCopyButton target={codeId} label={labels.copy} copiedLabel={labels.copied} />
					</figcaption>

					<pre
						className={`language-${language}`}
						style={{ border: 0, borderRadius: 0, margin: 0, background: "transparent" }}
						mix={[
							p(4),
							overflowX("auto"),
							raw({ overscrollBehaviorInline: "contain" }),
							font("mono"),
							text("sm"),
						]}
					>
						<code id={codeId} className={`language-${language}`}>
							{runs.length > 0
								? runs.map((token, index) =>
										token.type === "plain" ? (
											token.value
										) : (
											<span key={index} className={`token ${token.type}`}>
												{token.value}
											</span>
										),
									)
								: content}
						</code>
					</pre>
				</figure>
			);
		};
	}

	/**
	 * Draws one alert, tinted by its kind and opened by the kind's glyph and label, so a
	 * screen reader announces what the aside is before reading it.
	 */
	function DocsAlert(handle: Handle<AlertProps>) {
		return () => {
			let { children, kind } = handle.props;
			let resolved = isAlertKind(kind) ? kind : "note";
			let { color, Glyph } = ALERT_KINDS[resolved];
			let label = labels.alerts[resolved];

			return (
				<aside
					aria-label={label}
					data-color={color}
					mix={[
						semanticColorPanel(),
						vstack({ gap: 2 }),
						m("1.5rem", 0),
						p(4, 5),
						rounded("lg"),
						border({ width: 1, style: "solid" }),
						text("sm"),
						when("& > *", mb(0)),
						when("& > p", m(0)),
					]}
				>
					<p
						mix={[
							m(0),
							hstack({ gap: 2, align: "center" }),
							font("mono"),
							text("xs"),
							weight("semibold"),
							textTransform("uppercase"),
							tracking("widest"),
						]}
					>
						<span mix={[inlineFlex()]}>
							<Glyph size={14} aria-hidden="true" />
						</span>
						{label}
					</p>
					{children}
				</aside>
			);
		};
	}

	return { code: DocsCode, alert: DocsAlert };
}
