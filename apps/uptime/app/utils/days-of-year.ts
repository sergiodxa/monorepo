import { eachDayOfInterval, endOfWeek, startOfDay, startOfWeek, subYears } from "date-fns";

export default function daysOfYear(today: Date) {
	let end = endOfWeek(startOfDay(today));
	let start = startOfWeek(subYears(end, 1));
	return eachDayOfInterval({ start, end });
}
