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
 * the taller quick-check card — heading and description in the header, then a captioned
 * control and a button in the content — which is a different structure rather than a
 * taller version of the same one, so a height prop could not have stood in for it. Each
 * bar sits inside one line box of the type step it stands in for rather than carrying
 * its own height, which is what keeps the two in step — see {@link SkeletonLine}; the
 * two control bars are the exception, since a control's height is its own, not its
 * text's.
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
	}
}

/** Renders {@link StatCardSkeleton.Props.count} bare placeholder cards. */
export default function StatCardSkeleton(handle: Handle<StatCardSkeleton.Props>) {
	return () => {
		let count = handle.props.count ?? 1;
		let shape = handle.props.shape ?? "stat";

		return (
			<>
				{Array.from({ length: count }, (_, index) =>
					shape === "field" ? (
						<Card key={index} mix={[grow(1), shrink(1), basis("240px")]}>
							<Card.Header>
								<SkeletonLine size="sm" width="45%" thickness="0.75rem" />
								<SkeletonLine size="sm" width="100%" thickness="0.625rem" />
								<SkeletonLine size="sm" width="70%" thickness="0.625rem" />
							</Card.Header>
							<Card.Content mix={[flex(), flexCol(), gap("16px")]}>
								<div mix={[flex(), flexCol(), gap("4px")]}>
									<SkeletonLine size="sm" width="25%" thickness="0.625rem" />
									<SkeletonControl />
								</div>
								<SkeletonControl />
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
									<SkeletonLine size="sm" width="100%" thickness="0.625rem" />
								</div>
							</Card.Header>
						</Card>
					),
				)}
			</>
		);
	};
}
