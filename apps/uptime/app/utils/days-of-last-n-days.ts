import { eachDayOfInterval, subDays } from "date-fns";

export default function daysOfLastNDays(today: Date, n: number) {
	let start = subDays(today, n - 1);
	let end = today;
	return eachDayOfInterval({ start, end });
}
