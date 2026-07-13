/**
 * Placeholder shown as a dashboard stat-card `Frame`'s `fallback` while its real
 * content streams in — one or more bordered cards, each with three gray pulsing bars
 * standing in for a stat card's label, big value, and subtitle (see `StatCard`, whose
 * border/radius/padding this mirrors). Renders bare cards with no wrapping row of its
 * own, so multiple `Frame`s (each with their own `count`) can share one flex row
 * provided by the caller and combine into a single visual row of cards.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import { neutral } from "~/resources/theme";

namespace StatCardSkeleton {
	export interface Props {
		/** How many placeholder cards to render. Defaults to 1. */
		count?: number;
	}
}

const card = css({
	flex: "1 1 160px",
	padding: 16,
	borderRadius: 8,
	border: `1px solid ${neutral[200]}`,
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[800],
	},
});

/** A gray pulsing placeholder bar; width/height vary per line (label/value/subtitle). */
const bar = css({
	borderRadius: 4,
	background: neutral[200],
	animation: "uptime-stat-skeleton-pulse 1.5s ease-in-out infinite",
	"@keyframes uptime-stat-skeleton-pulse": {
		"0%": { opacity: 0.5 },
		"50%": { opacity: 1 },
		"100%": { opacity: 0.5 },
	},
	"@media (prefers-color-scheme: dark)": {
		background: neutral[800],
	},
});

const label = css({ width: "60%", height: 12, marginBottom: 12 });
const value = css({ width: "45%", height: 28, marginBottom: 10 });
const subtitle = css({ width: "100%", height: 10 });

/** Renders {@link StatCardSkeleton.Props.count} bare placeholder stat cards. */
export default function StatCardSkeleton(handle: Handle<StatCardSkeleton.Props>) {
	return () => {
		let count = handle.props.count ?? 1;

		return (
			<>
				{Array.from({ length: count }, (_, index) => (
					<div key={index} mix={[card]}>
						<div mix={[bar, label]} />
						<div mix={[bar, value]} />
						<div mix={[bar, subtitle]} />
					</div>
				))}
			</>
		);
	};
}
