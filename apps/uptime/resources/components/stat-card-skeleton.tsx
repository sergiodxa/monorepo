/**
 * Placeholder shown as a dashboard `Frame`'s `fallback` while its real content streams
 * in — one or more `Card`s, each filled with pulsing `Skeleton` bars standing in for
 * the card that will replace it. Renders bare cards with no wrapping row of its own, so
 * multiple `Frame`s (each with their own `count`) can share one flex row provided by
 * the caller and combine into a single visual row of cards.
 *
 * Two card shapes, because the dashboard streams two kinds of card into one grid and a
 * fallback that is the wrong height moves the page when it swaps out. The `"stat"`
 * shape mirrors `StatCard`: one `Card.Header` child for the label and one for the value
 * (its subtitle nested inside, exactly as `StatCard` nests `Subtitle` inside `value`),
 * so the header contributes the same single gap either way. The `"field"` shape mirrors
 * the taller quick-check card — a title and a description in the header, then a
 * captioned control, the empty height that card holds open for the answer to a check,
 * and a button on the bottom edge — which is a different structure rather than a
 * taller version of the same one, so a height prop could not have stood in for it. Each
 * bar sits inside one line box of the type step it stands in for rather than carrying
 * its own height, which is what keeps the two in step — see {@link SkeletonLine}; the
 * two control bars are the exception, since a control's height is its own, not its
 * text's.
 *
 * A `"stat"` card's subtitle is one row per line it stands in for, since a card whose
 * subtitle is a stack of lines is that many line boxes taller and a one-line fallback
 * would jump by the difference. The 0.25rem column gap does double duty here: it is the
 * `Subtitle`'s own top margin under the value, and — because every line of a stacked
 * subtitle carries that same margin — the space between the lines too, so `n` rows and
 * `n` gaps come to the same sum either way.
 *
 * The description is two rows inside one box rather than two children of the header,
 * because the real one is a single wrapping paragraph and a second header child would
 * draw the header's gap through the middle of it.
 *
 * The `"field"` card fills its grid cell the way the real one does, so the button bar
 * sits on the bottom edge in the stretched two-column layout instead of drifting up to
 * where the content happens to end. The reserved answer height is the same sum the real
 * card reserves: a badge pill, the gap under it, and one `sm` line.
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
import { bs, mbs, minBs } from "@pkg/u/size";
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

/**
 * One pulsing bar the height of a form control rather than of a line of text, for the
 * `"field"` shape's input and button: `2.5rem` is `Input`'s own `bs(10)`, and `Button`
 * lands on the same height from its padding, border, and line box.
 */
function SkeletonControl() {
	return () => <Skeleton style={{ inlineSize: "100%", blockSize: "2.5rem" }} mix={[pulse()]} />;
}

namespace StatCardSkeleton {
	export interface Props {
		/** How many placeholder cards to render. Defaults to 1. */
		count?: number;
		/** Which card each placeholder stands in for. Defaults to `"stat"`. */
		shape?: "stat" | "field";
		/**
		 * How many subtitle lines the `"stat"` card reserves under its value. Defaults to
		 * 1, the shape of every stat card whose subtitle is a single caption; a caller
		 * whose real card reserves more lines passes the same number the card does, so the
		 * two stay the same height and the grid does not move when the frame swaps in.
		 */
		subtitleLines?: number;
	}
}

/** Renders {@link StatCardSkeleton.Props.count} bare placeholder cards. */
export default function StatCardSkeleton(handle: Handle<StatCardSkeleton.Props>) {
	return () => {
		let count = handle.props.count ?? 1;
		let shape = handle.props.shape ?? "stat";
		let subtitleLines = handle.props.subtitleLines ?? 1;

		return (
			<>
				{Array.from({ length: count }, (_, index) =>
					shape === "field" ? (
						<Card key={index} mix={[flex(), flexCol(), grow(1), shrink(1), basis("240px")]}>
							<Card.Header>
								<SkeletonLine size="lg" leading="none" width="45%" thickness="0.75rem" />
								<div mix={[flex(), flexCol()]}>
									<SkeletonLine size="sm" leading="inherit" width="100%" thickness="0.625rem" />
									<SkeletonLine size="sm" leading="inherit" width="70%" thickness="0.625rem" />
								</div>
							</Card.Header>
							<Card.Content mix={[flex(), flexCol(), gap("12px"), grow(1)]}>
								<div mix={[flex(), flexCol(), gap("4px")]}>
									<SkeletonLine size="sm" leading="none" width="25%" thickness="0.625rem" />
									<SkeletonControl />
								</div>
								<div mix={[minBs("calc(0.75rem + 0.25rem + 2px + 0.5rem + 1.25rem)")]} />
								<div mix={[mbs("auto")]}>
									<SkeletonControl />
								</div>
							</Card.Content>
						</Card>
					) : (
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
					),
				)}
			</>
		);
	};
}
