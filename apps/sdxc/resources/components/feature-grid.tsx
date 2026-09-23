/**
 * The `feature-grid` tag: the container the cards of a claim section sit in. The grid
 * collapses to one column below the breakpoint, and `columns` caps how wide the set
 * spreads above it. The heading scope is what puts each card's title one level under
 * the band's own heading, so the page reads as one outline.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { gap, grid, gridTemplate, repeat } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { HeadingScope } from "@sdxc/ui";

import type { MarkdownProps } from "~/resources/components/markdown-props";

namespace FeatureGrid {
	/** How many cards a wide screen puts on one row. */
	export type Columns = "2" | "3";

	export interface Props extends MarkdownProps {
		columns?: Columns;
	}
}

/** Renders the card grid. */
export default function FeatureGrid(handle: Handle<FeatureGrid.Props>) {
	return () => {
		let { children, columns = "2" } = handle.props;

		return (
			<div
				mix={[
					grid(),
					gap(4),
					gridTemplate({ columns: "1fr" }),
					media(
						"(min-width: 48rem)",
						gridTemplate({ columns: repeat(Number(columns), "minmax(0, 1fr)") }),
					),
				]}
			>
				<HeadingScope level={3}>{children}</HeadingScope>
			</div>
		);
	};
}
