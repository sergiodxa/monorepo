/**
 * Public surface of the dates package: `Intl`-only formatting, calendar operations
 * that always take the zone they depend on, day-grid helpers, and the day key. The
 * zone math is internal; nothing here needs a locale database of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	CalendarDay,
	DateStyle,
	Day,
	Interval,
	Locale,
	TimeStyle,
	TimeZone,
	Weekday,
} from "./types";

export type { StartOfWeekOptions } from "./boundaries";
export type {
	FormatDateOptions,
	FormatDateTimeOptions,
	FormatRangeOptions,
	FormatTimeOptions,
} from "./format-date-time";
export type { FormatDurationOptions } from "./format-duration";
export type { FormatPartsOptions, FormatWeekdayOptions } from "./format-parts";
export type { FormatRelativeOptions } from "./format-relative";
export type { GroupByWeekOptions, LastNDaysOptions } from "./grid";

export { add, addDays, elapsed, subDays, subtract } from "./arithmetic";
export { endOfDay, startOfDay, startOfWeek } from "./boundaries";
export { diffInDays, eachDayOfInterval, isSameDay } from "./compare";
export { fromDayKey, parseDayKey, toDayKey } from "./day-key";
export { formatDate, formatDateTime, formatRange, formatTime } from "./format-date-time";
export { formatDuration } from "./format-duration";
export { formatParts, formatWeekday } from "./format-parts";
export { formatRelative } from "./format-relative";
export { daysOfYear, groupByWeek, lastNDays } from "./grid";
export { InvalidDateError } from "./invalid-date-error";
export { InvalidDayKeyError } from "./invalid-day-key-error";
export { parseDate } from "./parse-date";
