const BASE_DATE = new Date(Date.UTC(2025, 0, 6));
const MILLISECONDS_PER_DAY = 86400000;

export default function getDayLabel(locale: string, dayOfWeek: number, timeZone = "UTC"): string {
	return new Intl.DateTimeFormat(locale, {
		weekday: "short",
		timeZone,
	}).format(new Date(BASE_DATE.getTime() + dayOfWeek * MILLISECONDS_PER_DAY));
}
