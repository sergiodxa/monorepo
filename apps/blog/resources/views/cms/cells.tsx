/**
 * Table cells every CMS list shares, kept free of server-only imports so a browser test can
 * mount them. A date cell holds one line however narrow its column gets, so a squeezed table
 * scrolls inside its box instead of stacking "Dec / 1, / 2026" into a tall row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { whiteSpace } from "@sdxc/u/typography";
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
