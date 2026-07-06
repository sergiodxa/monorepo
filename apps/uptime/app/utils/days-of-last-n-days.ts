/**
 * Returns an array of `Date` objects covering the last `n` days ending on the given date,
 * inclusive, in chronological order. It is built on date-fns interval and subtraction
 * helpers. Rolling-window heatmaps and stats use it to enumerate the recent days to show.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { eachDayOfInterval, subDays } from "date-fns";

export default function daysOfLastNDays(today: Date, n: number) {
	let start = subDays(today, n - 1);
	let end = today;
	return eachDayOfInterval({ start, end });
}
