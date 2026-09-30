/**
 * Public surface of the dates package: `Intl`-only formatting, calendar operations that
 * always take the zone they depend on, day-grid helpers, and the day key. The raw zone
 * math lives on the `@sdxc/dates/zone` subpath, and every format draws its locale data
 * from the runtime's own `Intl` implementation.
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
} from "./types.js";

export type { StartOfWeekOptions } from "./boundaries.js";
export type {
	FormatDateOptions,
	FormatDateTimeOptions,
	FormatRangeOptions,
	FormatTimeOptions,
} from "./format-date-time.js";
export type { FormatDurationOptions } from "./format-duration.js";
export type { FormatPartsOptions, FormatWeekdayOptions } from "./format-parts.js";
export type { FormatRelativeOptions } from "./format-relative.js";
export type { GroupByWeekOptions, LastNDaysOptions } from "./grid.js";

export {
	add,
	addDays,
	elapsed,
	fromUnixSeconds,
	subDays,
	subtract,
	toUnixSeconds,
} from "./arithmetic.js";
export { endOfDay, startOfDay, startOfWeek } from "./boundaries.js";
export { diffInDays, eachDayOfInterval, isSameDay } from "./compare.js";
export { parseDateTimeLocal, toDateTimeLocal } from "./date-time-local.js";
export { fromDayKey, parseDayKey, toDayKey } from "./day-key.js";
export { formatDate, formatDateTime, formatRange, formatTime } from "./format-date-time.js";
export { formatDuration } from "./format-duration.js";
export { formatParts, formatWeekday } from "./format-parts.js";
export { formatRelative } from "./format-relative.js";
export { daysOfYear, groupByWeek, lastNDays } from "./grid.js";
export { InvalidDateError } from "./invalid-date-error.js";
export { InvalidDateTimeLocalError } from "./invalid-date-time-local-error.js";
export { InvalidDayKeyError } from "./invalid-day-key-error.js";
export { addMonths, endOfMonth, endOfQuarter, startOfMonth, startOfQuarter } from "./month.js";
export { parseDate } from "./parse-date.js";
export { daysInMonth, isValidTimeZone } from "./zone.js";
