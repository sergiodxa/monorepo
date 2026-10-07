/**
 * Text with the stretches a search matched marked: a run of `{ text, match }` segments
 * rendered as one inline `<span>`, each matched stretch a native `<mark>` tinted through a
 * semantic color role. Segments stay text nodes, so the content is escaped by construction.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { data, when } from "@sdxc/u/state";

import type { SemanticColor } from "../utils/semantic-color.js";

/** Semantic color role {@link Highlight} falls back to when `color` is omitted. */
const DEFAULT_COLOR: Highlight.Color = "brand";

/**
 * Prop types for {@link Highlight}.
 */
export namespace Highlight {
	/** Semantic color role the marks are tinted with. */
	export type Color = SemanticColor;

	/** One stretch of the text, and whether the query matched it. */
	export interface Segment {
		/** The stretch exactly as written. */
		text: string;
		/** Whether this stretch is drawn as a `<mark>`. */
		match: boolean;
	}

	/**
	 * Every native `<span>` attribute except `children`, which the segments replace, plus
	 * the `mix` passthrough.
	 */
	export interface Props extends Omit<TagProps<"span">, "children"> {
		/** The text in order, split where the matches start and end. */
		segments: ReadonlyArray<Segment>;
		/** Semantic color role of the marks. Defaults to {@link DEFAULT_COLOR}. */
		color?: Color;
	}
}

/**
 * Renders the segments inline, each match as a `<mark>` with a quiet tint behind text
 * that keeps the surrounding color and weight, so a match inside a link still reads as
 * the link. A mark broken across lines keeps its rounded tint on every fragment.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the highlighted text.
 * @example
 * <Highlight segments={[{ text: "Remix", match: true }, { text: " routing", match: false }]} />
 * @example
 * <Link href={post.href}><Highlight segments={post.title} color="warning" /></Link>
 */
export function Highlight(handle: Handle<Highlight.Props>) {
	return () => {
		let { color, segments, mix, ...rest } = handle.props;

		return (
			<span
				data-color={color ?? DEFAULT_COLOR}
				{...rest}
				mix={[
					when("& > mark", [
						fg("inherit"),
						rounded("sm"),
						raw({
							fontWeight: "inherit",
							paddingInline: "0.1em",
							marginInline: "-0.1em",
							boxDecorationBreak: "clone",
							WebkitBoxDecorationBreak: "clone",
						}),
					]),
					data("color", "brand", when("& > mark", bg("brand.tint"))),
					data("color", "neutral", when("& > mark", bg("neutral.tint"))),
					data("color", "success", when("& > mark", bg("success.tint"))),
					data("color", "warning", when("& > mark", bg("warning.tint"))),
					data("color", "danger", when("& > mark", bg("danger.tint"))),
					mix,
				]}
			>
				{segments.map((segment) => (segment.match ? <mark>{segment.text}</mark> : segment.text))}
			</span>
		);
	};
}
