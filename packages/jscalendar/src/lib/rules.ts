/**
 * Recurrence rules in both directions between JSCalendar's RecurrenceRule and iCalendar's
 * RRULE, which RFC 8984 defines as the same semantics in JSON. Expansion and the iCalendar
 * conversion both go through here, so they read a rule the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { ICalendar } from "@sdxc/icalendar";
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { JSCalendar } from "../types.js";

import { RecurrenceError } from "./errors.js";

/**
 * Converts a RecurrenceRule into an RRULE. RFC 7529 calendar systems other than Gregorian,
 * leap months and a `skip` other than `omit` have no RRULE counterpart here and fail.
 *
 * @param rule - The JSCalendar rule
 * @param until - Turns the rule's `until` into the UNTIL the event's start calls for
 * @returns The iCalendar rule, or why it cannot be expressed
 */
export function toICalendarRule(
	rule: JSCalendar.RecurrenceRule,
	until: (value: JSCalendar.LocalDateTime) => ICalendar.DateValue,
): Result<ICalendar.RecurrenceRule, RecurrenceError> {
	if (rule.rscale !== undefined && rule.rscale.toLowerCase() !== "gregorian") {
		return failure(new RecurrenceError(`the ${rule.rscale} calendar system is not supported`));
	}
	if (rule.skip !== undefined && rule.skip !== "omit") {
		return failure(new RecurrenceError(`skip "${rule.skip}" is not supported`));
	}
	if (rule.byMonth?.some((month) => month.endsWith("L"))) {
		return failure(new RecurrenceError("leap months are not supported"));
	}

	let converted: ICalendar.RecurrenceRule = {
		frequency: rule.frequency.toUpperCase() as ICalendar.RecurrenceRule["frequency"],
	};
	if (rule.interval !== undefined && rule.interval !== 1) converted.interval = rule.interval;
	if (rule.count !== undefined) converted.count = rule.count;
	if (rule.until !== undefined) converted.until = until(rule.until);
	if (rule.bySecond) converted.bySecond = rule.bySecond;
	if (rule.byMinute) converted.byMinute = rule.byMinute;
	if (rule.byHour) converted.byHour = rule.byHour;
	if (rule.byDay) {
		converted.byDay = rule.byDay.map((nday) => {
			let weekday = nday.day.toUpperCase() as ICalendar.Weekday;
			return nday.nthOfPeriod === undefined ? { weekday } : { weekday, ordinal: nday.nthOfPeriod };
		});
	}
	if (rule.byMonthDay) converted.byMonthDay = rule.byMonthDay;
	if (rule.byYearDay) converted.byYearDay = rule.byYearDay;
	if (rule.byWeekNo) converted.byWeekNumber = rule.byWeekNo;
	if (rule.byMonth) converted.byMonth = rule.byMonth.map(Number);
	if (rule.bySetPosition) converted.bySetPosition = rule.bySetPosition;
	if (rule.firstDayOfWeek !== undefined && rule.firstDayOfWeek !== "mo") {
		converted.weekStart = rule.firstDayOfWeek.toUpperCase() as ICalendar.Weekday;
	}
	return success(converted);
}

/**
 * Converts an RRULE into a RecurrenceRule, the frequency and weekdays lowercased as the
 * mapping draft writes them.
 *
 * @param rule - The iCalendar rule
 * @param until - Turns the rule's UNTIL into a LocalDateTime in the object's zone
 * @returns The JSCalendar rule
 */
export function fromICalendarRule(
	rule: ICalendar.RecurrenceRule,
	until: (value: ICalendar.DateValue) => JSCalendar.LocalDateTime,
): JSCalendar.RecurrenceRule {
	let converted: JSCalendar.RecurrenceRule = {
		"@type": "RecurrenceRule",
		frequency: rule.frequency.toLowerCase() as JSCalendar.RecurrenceRule["frequency"],
	};
	if (rule.interval !== undefined && rule.interval !== 1) converted.interval = rule.interval;
	if (rule.weekStart !== undefined && rule.weekStart !== "MO") {
		converted.firstDayOfWeek = rule.weekStart.toLowerCase() as JSCalendar.Weekday;
	}
	if (rule.byDay) {
		converted.byDay = rule.byDay.map(({ weekday, ordinal }) => {
			let day = weekday.toLowerCase() as JSCalendar.Weekday;
			return ordinal === undefined
				? { "@type": "NDay", day }
				: { "@type": "NDay", day, nthOfPeriod: ordinal };
		});
	}
	if (rule.byMonthDay) converted.byMonthDay = rule.byMonthDay;
	if (rule.byMonth) converted.byMonth = rule.byMonth.map(String);
	if (rule.byYearDay) converted.byYearDay = rule.byYearDay;
	if (rule.byWeekNumber) converted.byWeekNo = rule.byWeekNumber;
	if (rule.byHour) converted.byHour = rule.byHour;
	if (rule.byMinute) converted.byMinute = rule.byMinute;
	if (rule.bySecond) converted.bySecond = rule.bySecond;
	if (rule.bySetPosition) converted.bySetPosition = rule.bySetPosition;
	if (rule.count !== undefined) converted.count = rule.count;
	if (rule.until !== undefined) converted.until = until(rule.until);
	return converted;
}
