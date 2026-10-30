/**
 * The `note` and `warning` tags: a short aside beside the argument it qualifies. It is
 * an `<aside>` rather than a live region, because the text is there when the page
 * loads and nothing updates it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { InfoIcon, TriangleAlertIcon } from "@sdxc/icons";
import { border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { hstack, inlineFlex, vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { font, text, textTransform, tracking, weight } from "@sdxc/u/typography";
import { semanticColorPanel } from "@sdxc/ui/styles";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import { blocksUseGap } from "~/resources/components/block-flow";

namespace Note {
	/** What the aside is doing: adding a fact, or warning about one. */
	export type Kind = "info" | "caution";

	export interface Props extends MarkdownProps {
		kind?: Kind;
		/** A word read before the text, so a screen reader announces what the aside is. */
		label?: string;
	}
}

/**
 * Renders one aside, tinted by its kind and opened by its label when it has one. The
 * label carries the kind's glyph, so a note and a warning differ by more than tint.
 */
export default function Note(handle: Handle<Note.Props>) {
	return () => {
		let { children, kind = "info", label } = handle.props;
		let Glyph = kind === "caution" ? TriangleAlertIcon : InfoIcon;

		return (
			<aside
				aria-label={label}
				data-color={kind === "caution" ? "warning" : "brand"}
				mix={[
					semanticColorPanel(),
					vstack({ gap: 2 }),
					blocksUseGap(),
					p(4, 5),
					rounded("lg"),
					border({ width: 1, style: "solid" }),
					text("sm"),
				]}
			>
				{label ? (
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
				) : null}
				{children}
			</aside>
		);
	};
}

/**
 * A guide's `<note>`: a fact the reader can skip on a first read and will want later,
 * labelled "Note" so it reads as an aside rather than as the next step.
 */
export function GuideNote(handle: Handle<MarkdownProps>) {
	return () => (
		<Note kind="info" label="Note">
			{handle.props.children}
		</Note>
	);
}

/**
 * A guide's `<warning>`: what breaks, or what cannot be undone, when the reader skips
 * it. Labelled "Warning" and tinted as a caution.
 */
export function GuideWarning(handle: Handle<MarkdownProps>) {
	return () => (
		<Note kind="caution" label="Warning">
			{handle.props.children}
		</Note>
	);
}
