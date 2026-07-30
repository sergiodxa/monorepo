/**
 * Placeholder shown as a dashboard stat-card `Frame`'s `fallback` while its real
 * content streams in — one or more `Card`s, each with pulsing `Skeleton` bars standing
 * in for a stat card's label, big value, and subtitle. Renders bare cards with no
 * wrapping row of its own, so multiple `Frame`s (each with their own `count`) can share
 * one flex row provided by the caller and combine into a single visual row of cards.
 *
 * Mirrors `StatCard`'s structure closely enough to occupy the same height, so swapping
 * the real card in doesn't shift the page: one `Card.Header` child for the label and
 * one for the value (its subtitle nested inside, exactly as `StatCard` nests
 * `Subtitle` inside `value`), so the header contributes the same single gap either way.
 * Each bar sits inside one line box of the type step it stands in for rather than
 * carrying its own height, which is what keeps the two in step — see
 * {@link SkeletonLine}.
 *
 * `@pkg/r3-ui`'s `Skeleton` carries no animation of its own — the `pulse()` mixin
 * from `@pkg/r3-ui/animations` supplies the breathing loop, matching the original
 * hand-rolled `@keyframes` shimmer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Card, Skeleton } from "@pkg/r3-ui";
import { pulse } from "@pkg/r3-ui/animations";
import { basis, flex, flexCol, gap, grow, items, shrink } from "@pkg/u/layout";
import { bs } from "@pkg/u/size";
import { text } from "@pkg/u/typography";

namespace SkeletonLine {
	export interface Props {
		/** The text step whose line box this row stands in for (`StatCard`'s own steps). */
		size: "sm" | "2xl";
		/** How much of the row's width the bar fills. */
		width: string;
		/** The bar's thickness, centered inside the line box. */
		thickness: string;
	}
}

/**
 * One pulsing bar occupying exactly one line box of {@link SkeletonLine.Props.size}
 * text: `bs("1lh")` resolves against the `line-height` the same `text()` step gives
 * the real card's copy, so a row is as tall as the line it replaces no matter how
 * thick its bar is, and stays that way if the type scale is retuned. A browser without
 * `lh` support drops the declaration and falls back to the bar's own height, which is
 * merely the slightly-too-short placeholder this replaced.
 */
function SkeletonLine(handle: Handle<SkeletonLine.Props>) {
	return () => (
		<div mix={[text(handle.props.size), bs("1lh"), flex(), items("center")]}>
			<Skeleton
				style={{ inlineSize: handle.props.width, blockSize: handle.props.thickness }}
				mix={[pulse()]}
			/>
		</div>
	);
}

namespace StatCardSkeleton {
	export interface Props {
		/** How many placeholder cards to render. Defaults to 1. */
		count?: number;
	}
}

/** Renders {@link StatCardSkeleton.Props.count} bare placeholder stat cards. */
export default function StatCardSkeleton(handle: Handle<StatCardSkeleton.Props>) {
	return () => {
		let count = handle.props.count ?? 1;

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
								<SkeletonLine size="sm" width="100%" thickness="0.625rem" />
							</div>
						</Card.Header>
					</Card>
				))}
			</>
		);
	};
}
