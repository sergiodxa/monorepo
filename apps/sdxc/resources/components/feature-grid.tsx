/**
 * The `feature-grid` tag: the claims of a section as a ruled grid, each in a cell of its
 * own with hairlines between them rather than cards floating apart. The grid collapses to
 * one column below the breakpoint, and `columns` caps how wide the set spreads above it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { gap, grid, gridTemplate, repeat } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { media } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import type { MarkdownProps } from "~/resources/components/markdown-props";

namespace FeatureGrid {
	/** How many cells a wide screen puts on one row. */
	export type Columns = "2" | "3";

	export interface Props extends MarkdownProps {
		columns?: Columns;
	}
}

/**
 * Renders the grid. The hairlines are the grid's own background showing through a
 * one-pixel gap between cells, so they stay one pixel wherever a row wraps.
 */
export default function FeatureGrid(handle: Handle<FeatureGrid.Props>) {
	return () => {
		let { children, columns = "2" } = handle.props;

		return (
			<div
				mix={[
					grid(),
					gap("1px"),
					rounded("xl"),
					overflow("hidden"),
					border({ color: "neutral.border", width: 1, style: "solid" }),
					raw({ backgroundColor: "var(--ui-neutral-border)", textAlign: "start" }),
					gridTemplate({ columns: "minmax(0, 1fr)" }),
					media("(min-width: 48rem)", [
						gridTemplate({ columns: repeat(Number(columns), "minmax(0, 1fr)") }),
						/*
						 * A last row with fewer cells than columns stretches its last cell across
						 * the gap, so the hairline color never shows through as an empty cell.
						 */
						columns === "2"
							? when("& > :last-child:nth-child(odd)", raw({ gridColumn: "1 / -1" }))
							: [
									when("& > :last-child:nth-child(3n + 1)", raw({ gridColumn: "1 / -1" })),
									when("& > :last-child:nth-child(3n + 2)", raw({ gridColumn: "span 2" })),
								],
					]),
				]}
			>
				{children}
			</div>
		);
	};
}
