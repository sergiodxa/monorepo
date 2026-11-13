/**
 * The marks Margin's notes are made with: a timestamp that links a claim to the transcript
 * line it came from, the highlighter, a margin note in the hand, and a red-pen correction.
 * Every band marks its paper with these, so a mark means the same thing everywhere.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { focusVisible, hover } from "@sdxc/u/state";

import { lineId, TRANSCRIPT } from "~/resources/views/demos/ai/meeting";
import { HAND, HIGHLIGHTER, HIGHLIGHTER_INK, MONO, RED_PEN } from "~/resources/views/demos/ai/type";

namespace Cite {
	/** The line a claim rests on. */
	export interface Props {
		/** The cited line's `mm:ss`. */
		time: string;
	}
}

/**
 * A timestamp linking to its transcript line. Its name says who spoke, so a screen reader
 * hears the source as well as the time; following it lands on the line, marked by `:target`.
 *
 * @param handle Runtime handle carrying the cited time.
 * @returns The render function producing the link.
 */
export function Cite(handle: Handle<Cite.Props>) {
	return () => {
		let { time } = handle.props;
		let speaker = TRANSCRIPT.find((line) => line.time === time)?.speaker ?? "";
		return (
			<a
				href={`#${lineId(time)}`}
				aria-label={`Source: ${speaker} at ${time}`}
				data-slot="margin-cite"
				mix={[
					raw({
						display: "inline-block",
						marginInlineStart: "0.375rem",
						paddingInline: "0.3125rem",
						borderRadius: "0.25rem",
						fontFamily: MONO,
						fontSize: "0.75rem",
						lineHeight: "1.25rem",
						fontVariantNumeric: "tabular-nums",
						color: "var(--ui-brand-fg)",
						textDecoration: "none",
						boxShadow: "inset 0 0 0 1px color-mix(in oklch, var(--ui-brand-fg) 35%, transparent)",
						whiteSpace: "nowrap",
						verticalAlign: "baseline",
					}),
					hover(
						raw({ backgroundColor: "color-mix(in oklch, var(--ui-brand-fg) 10%, transparent)" }),
					),
					focusVisible(raw({ outline: "2px solid var(--ui-brand-fg)", outlineOffset: "2px" })),
				]}
			>
				{time}
			</a>
		);
	};
}

namespace Highlight {
	/** The words to mark. */
	export interface Props {
		children: RemixNode;
	}
}

/**
 * Words run over with the yellow marker: a slightly ragged band behind dark ink, wrapping
 * line by line like a real stroke across a broken sentence.
 *
 * @param handle Runtime handle carrying the marked words.
 * @returns The render function producing the mark.
 */
export function Highlight(handle: Handle<Highlight.Props>) {
	return () => (
		<mark
			mix={[
				raw({
					color: HIGHLIGHTER_INK,
					backgroundColor: "transparent",
					backgroundImage: `linear-gradient(100deg, transparent 0.15em, ${HIGHLIGHTER} 0.3em, ${HIGHLIGHTER} calc(100% - 0.3em), transparent calc(100% - 0.1em))`,
					paddingInline: "0.2em",
					marginInline: "-0.2em",
					borderRadius: "0.35em 0.2em 0.4em 0.25em",
					boxDecorationBreak: "clone",
					WebkitBoxDecorationBreak: "clone",
				}),
			]}
		>
			{handle.props.children}
		</mark>
	);
}

namespace HandNote {
	/** The note and the pen it is written in. */
	export interface Props {
		/** Red for a correction or a warning; blue ink otherwise. */
		pen?: "ink" | "red";
		children: RemixNode;
	}
}

/**
 * A note written in the margin, in the system's handwriting face and the pen's colour,
 * set a size up because a hand reads smaller than a typed face.
 *
 * @param handle Runtime handle carrying the note and its pen.
 * @returns The render function producing the note.
 */
export function HandNote(handle: Handle<HandNote.Props>) {
	return () => (
		<span
			data-slot="margin-hand"
			mix={[
				raw({
					fontFamily: HAND,
					fontSize: "1.0625rem",
					lineHeight: "1.4",
					color: handle.props.pen === "red" ? RED_PEN : "var(--ui-brand-fg)",
				}),
			]}
		>
			{handle.props.children}
		</span>
	);
}

namespace Struck {
	/** The words the red pen strikes. */
	export interface Props {
		children: RemixNode;
	}
}

/**
 * Words struck through in red pen, kept legible under the stroke so a reader sees what
 * was wrong as well as the correction beside it.
 *
 * @param handle Runtime handle carrying the struck words.
 * @returns The render function producing the struck text.
 */
export function Struck(handle: Handle<Struck.Props>) {
	return () => (
		<del
			mix={[
				raw({
					textDecorationLine: "line-through",
					textDecorationColor: RED_PEN,
					textDecorationThickness: "2px",
					color: "var(--ui-neutral-fg-muted)",
				}),
			]}
		>
			{handle.props.children}
		</del>
	);
}
