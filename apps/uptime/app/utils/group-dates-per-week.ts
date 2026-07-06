/**
 * Groups a flat list of dates into buckets by calendar week, returning an array of
 * per-week date arrays. It uses date-fns with a Sunday week start to compute each date's
 * week and week-year, nudging the numbering so weeks line up within a single year. The
 * heatmap uses it to lay dates out into weekly columns.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getWeek, getWeekYear } from "date-fns";

export default function groupDatesPerWeek(dates: Date[]) {
	if (dates.length === 0) return [];

	let initialYear = getWeekYear(dates[0] as Date, {
		weekStartsOn: 0,
		firstWeekContainsDate: 1,
	});

	let map = dates.reduce((groups, date) => {
		let week = getWeek(date, { weekStartsOn: 0, firstWeekContainsDate: 1 });
		let year = getWeekYear(date, { weekStartsOn: 0, firstWeekContainsDate: 1 });

		if (year === initialYear) week++;
		let group = groups.get(week);
		if (group) group.add(date);
		else {
			groups.set(week, new Set([date]));
		}

		return groups;
	}, new Map<number, Set<Date>>());

	return Array.from(map.values()).map((group) => Array.from(group));
}
