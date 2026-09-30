/**
 * Draws every fenced code block: a bordered card headed by the path or title the
 * annotation wrote, with the copy button in that header. A fence that names neither
 * drops the header and floats the button over the code instead.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { FileCodeIcon } from "@sdxc/icons";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hstack, inlineFlex, shrink } from "@sdxc/u/layout";
import { overflowX, overscrollBehavior } from "@sdxc/u/overflow";
import { m, p } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { Separator } from "@sdxc/ui";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import { CopyButton } from "~/resources/components/copy-button";
import { stableId } from "~/resources/components/stable-id";

/** The language a fence left unnamed, so the stylesheet still has a class to match. */
const PLAIN_LANGUAGE = "plain";

namespace CodeBlock {
	/** One painted run of source, structural so any painter's output renders here. */
	export interface Token {
		type: string;
		value: string;
	}

	export interface Props extends MarkdownProps {
		/** The source as written, drawn whenever the block arrived unpainted. */
		content: string;
		language?: string;
		tokens?: unknown;
		/** What the header reads as; the path wins when the fence wrote both. */
		title?: string;
		path?: string;
	}
}

/** Renders one fenced code block. */
export default function CodeBlock(handle: Handle<CodeBlock.Props>) {
	return () => {
		let { content, language = PLAIN_LANGUAGE, path, title, tokens } = handle.props;
		let heading = path ?? title;
		let codeId = stableId("code", content);
		let runs = Array.isArray(tokens) ? tokens.filter(isToken) : [];

		let code = (
			<pre
				className={`language-${language}`}
				/*
				 * The block around the code draws its frame and background, so a prose stylesheet's
				 * own rules for `pre` would draw a second box inside it; the inline style clears them.
				 */
				style={{ border: 0, borderRadius: 0, background: "transparent" }}
				mix={[
					m(0),
					p(4),
					/* Beside the copy button the code takes the rest of the row and scrolls within it. */
					raw({ flex: "1 1 auto", minInlineSize: 0 }),
					overflowX("auto"),
					overscrollBehavior("contain"),
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
		);

		if (!heading) {
			/*
			 * The copy button takes its own column rather than floating over the code, so a
			 * long line scrolls beside it instead of under it. A single line centers the
			 * button on itself; a longer block keeps it level with the first line.
			 */
			return (
				<div
					mix={[
						hstack({ gap: 0, align: content.trim().includes("\n") ? "start" : "center" }),
						rounded("lg"),
						border({ color: "neutral.border", width: 1, style: "solid" }),
						bg(),
					]}
				>
					{code}
					<span mix={[inlineFlex(), shrink(0), p(2)]}>
						<CopyButton target={codeId} bare />
					</span>
				</div>
			);
		}

		return (
			<div
				mix={[rounded("lg"), border({ color: "neutral.border", width: 1, style: "solid" }), bg()]}
			>
				<div mix={[hstack({ gap: 2, align: "center", justify: "between" }), p(2, 2, 2, 3)]}>
					<span mix={[hstack({ gap: 2, align: "center" }), fg("neutral")]}>
						<span mix={[inlineFlex()]}>
							<FileCodeIcon size={16} aria-hidden="true" />
						</span>
						<span mix={[font("mono"), text("sm"), weight("normal")]}>{heading}</span>
					</span>
					<CopyButton target={codeId} bare />
				</div>

				<Separator />

				{code}
			</div>
		);
	};
}

/** Guards each run, so a malformed field falls back to the raw source rather than throwing. */
function isToken(value: unknown): value is CodeBlock.Token {
	if (typeof value !== "object" || value === null) return false;
	let candidate = value as { type?: unknown; value?: unknown };
	return typeof candidate.type === "string" && typeof candidate.value === "string";
}
