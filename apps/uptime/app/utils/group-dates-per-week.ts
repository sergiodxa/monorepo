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
