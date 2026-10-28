/**
 * The `feature-grid` tag: the claims of a section as a ruled grid, each in a cell of its
 * own with hairlines between them rather than cards floating apart. Thin adapter over
 * {@link Feature.Grid} so the markdown `columns` attribute stays a string.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { Feature } from "sdxc/ui";

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

		return <Feature.Grid columns={Number(columns) as 2 | 3}>{children}</Feature.Grid>;
	};
}
