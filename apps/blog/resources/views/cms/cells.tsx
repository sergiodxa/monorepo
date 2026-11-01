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
import { font, text, truncate } from "@sdxc/u/typography";
import { Link } from "@sdxc/ui";
import { Table } from "@sdxc/ui/app/table";

import { parseTimestamp } from "~/app/models/post-values";

/** Props accepted by {@link DateCell}. */
interface DateCellProps {
	/**
	 * The moment in any form a stored timestamp takes: a `Date`, ISO or SQL text, or epoch
	 * seconds or milliseconds as a number or digits. `null` or an unreadable value renders `—`.
	 */
	date: Date | string | number | null | undefined;
	/** Hides the cell in a content area 40rem wide or narrower, as the column's header does. */
	hideNarrow?: boolean;
}

/**
 * A row's date in the viewer's zone and locale, relative within a week, on one line.
 */
export function DateCell(handle: Handle<DateCellProps>) {
	return () => {
		let { date, hideNarrow } = handle.props;
		let time = date instanceof Date ? date.getTime() : parseTimestamp(date);
		return (
			<Table.DateCell
				date={Number.isNaN(time) ? null : new Date(time)}
				locale="en-US"
				local
				mix={[
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
	/** Makes the path a link to this address. */
	href?: string;
	/** Hides the cell in a content area 40rem wide or narrower, as the column's header does. */
	hideNarrow?: boolean;
}

/** A path in monospace, or a link to it, cut with an ellipsis at the cell's edge so it never runs into the next. */
export function PathCell(handle: Handle<PathCellProps>) {
	return () => {
		let { path, maxInlineSize, muted, href, hideNarrow } = handle.props;
		let pathMix = [
			raw({ display: "block" }),
			font("mono"),
			text("sm"),
			muted ? fg("neutral.muted") : undefined,
			truncate(),
		];
		return (
			<Table.Cell
				mix={[
					raw({ maxInlineSize }),
					hideNarrow
						? raw({ "@container ui-app-content (max-width: 40rem)": { display: "none" } })
						: undefined,
				]}
			>
				{href === undefined ? (
					<span title={path} mix={pathMix}>
						{path}
					</span>
				) : (
					<Link href={href} title={href} mix={pathMix}>
						{path}
					</Link>
				)}
			</Table.Cell>
		);
	};
}
