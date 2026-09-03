/**
 * Placeholder shown as a dashboard `Frame`'s `fallback` while its real
 * content streams in, matching `StatCard`'s own header structure and height
 * so the page holds still when the real card swaps in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { rounded } from "@sdxc/u/effects";
import { basis, flex, flexCol, gap, grow, items, shrink } from "@sdxc/u/layout";
import { bs } from "@sdxc/u/size";
import { fontSize, leading, text } from "@sdxc/u/typography";
import { Card, Skeleton } from "@sdxc/ui";
import { pulse } from "@sdxc/ui/animations";

namespace SkeletonLine {
	export interface Props {
		/** The text step whose line box this row stands in for. */
		size: "sm" | "lg" | "2xl";
		/** How much of the row's width the bar fills. */
		width: string;
		/** The bar's thickness, centered inside the line box. */
		thickness: string;
		/**
		 * Which line-height the real line follows: `"scale"` for text set with
		 * `u.text()`, `"none"` for a collapsed leading like `Card.Title`/`Label`, and
		 * `"inherit"` for a bare font-size line like `Card.Description`. Defaults to `"scale"`.
		 */
		leading?: "scale" | "none" | "inherit";
	}
}

/**
 * One pulsing bar sized to exactly one line box of {@link SkeletonLine.Props.size}
 * text: `bs("1lh")` resolves against that size's own line height, so the row
 * tracks the type scale even if it is retuned later.
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
		 * How many subtitle lines the card reserves under its value, matching the real
		 * card's own line count so the two stay the same height when the frame swaps
		 * in. Defaults to 1, the shape of a single-caption subtitle.
		 */
		subtitleLines?: number;
		/**
		 * Draws the row under the value as a single badge-height pill, replacing the
		 * {@link StatCardSkeleton.Props.subtitleLines} lines for a card whose
		 * breakdown is a row of badges.
		 */
		badges?: boolean;
	}
}

/**
 * Renders {@link StatCardSkeleton.Props.count} bare cards for the caller to
 * arrange in its own shared row.
 */
export default function StatCardSkeleton(handle: Handle<StatCardSkeleton.Props>) {
	return () => {
		let count = handle.props.count ?? 1;
		let badges = handle.props.badges ?? false;
		let subtitleLines = handle.props.subtitleLines ?? 1;

		return (
			<>
				{Array.from({ length: count }, (_, index) => (
					<Card key={index} mix={[grow(1), shrink(1), basis("160px")]}>
						<Card.Header>
							<SkeletonLine size="sm" width="60%" thickness="0.75rem" />
							<div mix={[flex(), flexCol(), gap("0.25rem")]}>
								<SkeletonLine size="2xl" width="45%" thickness="1.75rem" />
								{badges ? (
									<Skeleton
										style={{ inlineSize: "70%", blockSize: "calc(0.75rem + 0.25rem + 2px)" }}
										mix={[rounded("full"), pulse()]}
									/>
								) : (
									Array.from({ length: subtitleLines }, (_, line) => (
										<SkeletonLine key={line} size="sm" width="100%" thickness="0.625rem" />
									))
								)}
							</div>
						</Card.Header>
					</Card>
				))}
			</>
		);
	};
}
