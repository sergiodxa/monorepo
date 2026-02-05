import { eachDayOfInterval, endOfYear, startOfYear } from "date-fns";

export default function daysOfYear(today: Date) {
	let start = startOfYear(today);
	let end = endOfYear(today);
	return eachDayOfInterval({ start, end });
}
