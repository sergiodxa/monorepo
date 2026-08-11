/**
 * Placeholder shown as a dashboard `Frame`'s `fallback` while its real content streams
 * in — one or more `Card`s, each filled with pulsing `Skeleton` bars standing in for
 * the card that will replace it. Renders bare cards with no wrapping row of its own, so
 * multiple `Frame`s (each with their own `count`) can share one flex row provided by
 * the caller and combine into a single visual row of cards.
 *
 * It mirrors `StatCard`'s own structure: one `Card.Header` child for the label and one
 * for the value, with its subtitle nested inside exactly as `StatCard` nests `Subtitle`
 * inside `value`, so the header contributes the same single gap either way — a fallback
 * that is the wrong height moves the page when it swaps out. Each bar sits inside one
 * line box of the type step it stands in for rather than carrying its own height, which
 * is what keeps the two in step; see {@link SkeletonLine}.
 *
 * The subtitle is one row per line it stands in for, since a card whose
 * subtitle is a stack of lines is that many line boxes taller and a one-line fallback
 * would jump by the difference. The 0.25rem column gap does double duty here: it is the
 * `Subtitle`'s own top margin under the value, and — because every line of a stacked
 * subtitle carries that same margin — the space between the lines too, so `n` rows and
 * `n` gaps come to the same sum either way.
 *
 * `@pkg/ui`'s `Skeleton` carries no animation of its own — the `pulse()` mixin
 * from `@pkg/ui/animations` supplies the breathing loop, matching the original
 * hand-rolled `@keyframes` shimmer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { basis, flex, flexCol, gap, grow, items, shrink } from "@pkg/u/layout";
import { bs } from "@pkg/u/size";
import { fontSize, leading, text } from "@pkg/u/typography";
import { Card, Skeleton } from "@pkg/ui";
import { pulse } from "@pkg/ui/animations";

namespace SkeletonLine {
	export interface Props {
		/** The text step whose line box this row stands in for. */
		size: "sm" | "lg" | "2xl";
		/** How much of the row's width the bar fills. */
		width: string;
		/** The bar's thickness, centered inside the line box. */
		thickness: string;
		/**
		 * Where the real line's line height comes from, since only some of them take the
		 * type scale's own pairing: `"scale"` for a line drawn with `u.text()`, `"none"`
		 * for one whose leading is collapsed to the font size (`Card.Title`, `Label`), and
		 * `"inherit"` for one that sets a font size and nothing else (`Card.Description`),
		 * leaving the document's own line height to set the box. Defaults to `"scale"`.
		 */
		leading?: "scale" | "none" | "inherit";
	}
}

/**
 * One pulsing bar occupying exactly one line box of {@link SkeletonLine.Props.size}
 * text: `bs("1lh")` resolves against the `line-height` this row resolves for itself,
 * so a row is as tall as the line it replaces no matter how thick its bar is, and
 * stays that way if the type scale is retuned. A browser without `lh` support drops
 * the declaration and falls back to the bar's own height, which is merely the
 * slightly-too-short placeholder this replaced.
 */
function SkeletonLine(handle: Handle<SkeletonLine.Props>) {
	return () => {
		let { size, width, thickness, leading: lineHeight = "scale" } = handle.props;

		return (
			<div
				mix={[
					lineHeight === "scale" ? text(size) : fontSize(size),
					lineHeight === "none" ? leading("none") : undefined,
					bs("1lh"),
					flex(),
					items("center"),
				]}
			>
				<Skeleton style={{ inlineSize: width, blockSize: thickness }} mix={[pulse()]} />
			</div>
		);
	};
}

namespace StatCardSkeleton {
	export interface Props {
		/** How many placeholder cards to render. Defaults to 1. */
		count?: number;
		/**
		 * How many subtitle lines the card reserves under its value. Defaults to 1, the
		 * shape of every stat card whose subtitle is a single caption; a caller whose real
		 * card reserves more lines passes the same number the card does, so the two stay
		 * the same height and the row does not move when the frame swaps in.
		 */
		subtitleLines?: number;
	}
}

/** Renders {@link StatCardSkeleton.Props.count} bare placeholder cards. */
export default function StatCardSkeleton(handle: Handle<StatCardSkeleton.Props>) {
	return () => {
		let count = handle.props.count ?? 1;
		let subtitleLines = handle.props.subtitleLines ?? 1;

		return (
			<>
				{Array.from({ length: count }, (_, index) => (
					<Card key={index} mix={[grow(1), shrink(1), basis("160px")]}>
						<Card.Header>
							<SkeletonLine size="sm" width="60%" thickness="0.75rem" />
							{/**
							 * The value and its subtitle in one header child, matching how `StatCard`
							 * renders both inside a single `value` node. The 0.25rem column gap stands
							 * in for `Subtitle`'s own top margin.
							 */}
							<div mix={[flex(), flexCol(), gap("0.25rem")]}>
								<SkeletonLine size="2xl" width="45%" thickness="1.75rem" />
								{Array.from({ length: subtitleLines }, (_, line) => (
									<SkeletonLine key={line} size="sm" width="100%" thickness="0.625rem" />
								))}
							</div>
						</Card.Header>
					</Card>
				))}
			</>
		);
	};
}
