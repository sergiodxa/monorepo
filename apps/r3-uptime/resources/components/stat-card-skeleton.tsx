/**
 * Placeholder shown as a dashboard stat-card `Frame`'s `fallback` while its real
 * content streams in — one or more `Card`s, each with three pulsing `Skeleton` bars
 * standing in for a stat card's label, big value, and subtitle (see `StatCard`, whose
 * `Card`/`Card.Header` structure this mirrors). Renders bare cards with no wrapping
 * row of its own, so multiple `Frame`s (each with their own `count`) can share one
 * flex row provided by the caller and combine into a single visual row of cards.
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
import { basis, grow, shrink } from "@pkg/u/layout";

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
							<Skeleton style={{ inlineSize: "60%", blockSize: "0.75rem" }} mix={[pulse()]} />
							<Skeleton style={{ inlineSize: "45%", blockSize: "1.75rem" }} mix={[pulse()]} />
							<Skeleton style={{ inlineSize: "100%", blockSize: "0.625rem" }} mix={[pulse()]} />
						</Card.Header>
					</Card>
				))}
			</>
		);
	};
}
