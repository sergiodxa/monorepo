/**
 * Table cells every CMS list shares, kept free of server-only imports so a browser test can
 * mount them. Each holds one line however narrow its column gets: a date never stacks into a
 * tall row, and a long path ends in an ellipsis inside its own cell.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { font, text, truncate, whiteSpace } from "@sdxc/u/typography";
import { Table } from "@sdxc/ui/app/table";

/** Props accepted by {@link DateCell}. */
interface DateCellProps {
	/** The moment, or an ISO string; `null` renders `—`. */
	date: Date | string | null;
	/** Hides the cell in a content area 40rem wide or narrower, as the column's header does. */
	hideNarrow?: boolean;
}

/**
 * A row's date in the viewer's zone and locale, relative within a week, on one line.
 */
export function DateCell(handle: Handle<DateCellProps>) {
	return () => {
		let { date, hideNarrow } = handle.props;
		return (
			<Table.DateCell
				date={date === null ? null : new Date(date)}
				locale="en-US"
				local
				mix={[
					whiteSpace("nowrap"),
					hideNarrow
						? raw({ "@container ui-app-content (max-width: 40rem)": { display: "none" } })
						: undefined,
				]}
			/>
		);
	};
}

/** Props accepted by {@link PathCell}. */
interface PathCellProps {
	/** The path or address, shown in full on hover. */
	path: string;
	/** The widest the column grows, as a CSS length. */
	maxInlineSize: string;
	/** Draws the path muted, for the secondary path in a row. */
	muted?: boolean;
}

/** A path in monospace, cut with an ellipsis at the cell's edge so it never runs into the next. */
export function PathCell(handle: Handle<PathCellProps>) {
	return () => {
		let { path, maxInlineSize, muted } = handle.props;
		return (
			<Table.Cell mix={[raw({ maxInlineSize })]}>
				<span
					title={path}
					mix={[
						raw({ display: "block" }),
						font("mono"),
						text("sm"),
						muted ? fg("neutral.muted") : undefined,
						truncate(),
					]}
				>
					{path}
				</span>
			</Table.Cell>
		);
	};
}
