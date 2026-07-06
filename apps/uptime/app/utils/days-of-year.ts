/**
 * Returns an array of `Date` objects for every day in the calendar year that contains the
 * given date, from January 1st through December 31st. It is built on date-fns interval and
 * year-boundary helpers. Year-scoped heatmaps use it to enumerate every cell to render.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { eachDayOfInterval, endOfYear, startOfYear } from "date-fns";

export default function daysOfYear(today: Date) {
	let start = startOfYear(today);
	let end = endOfYear(today);
	return eachDayOfInterval({ start, end });
}
