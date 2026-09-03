/**
 * The one place cron vocabulary becomes text a person reads: a parsed schedule's
 * descriptor into a sentence in the viewer's language, and a rejected expression into
 * a validation message. `@sdxc/cron` returns structured descriptors, so every view and
 * action sources its copy from here, keeping locale text centralized.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { InvalidCronExpression, TimeOfDay } from "@sdxc/cron";
import type { TFunction } from "@sdxc/i18n";

import { Schedule } from "@sdxc/cron";
import { isFailure } from "@sdxc/result";

/** The translator and locale a schedule sentence is built from. */
export interface ScheduleTextOptions {
	/** BCP 47 locale the weekday names, month names and list separators come from. */
	locale: string;
	/** The request's translator, i.e. `ctx.i18next.t`. */
	t: TFunction;
}

/** A Sunday at UTC midnight, the anchor weekday index `0` names. */
const WEEKDAY_ANCHOR_MS = Date.UTC(2026, 0, 4);

/** Milliseconds in a day, for stepping the weekday anchor. */
const MS_PER_DAY = 86_400_000;

/**
 * Describes a stored cron expression in the viewer's language: the descriptor's `kind`
 * picks the sentence and its numeric fields are interpolated into it. An expression that
 * no longer parses, or has no concise shape, falls back to showing itself as typed.
 *
 * @param expression - The expression as stored on the monitor.
 * @param options - The request's translator and locale.
 * @returns The description, ready to render.
 *
 * @example
 * describeSchedule("0 9 * * 1-5", { locale, t }); // "Every Monday, Tuesday … at 09:00"
 */
export function describeSchedule(expression: string, options: ScheduleTextOptions): string {
	let { locale, t } = options;

	let parsed = Schedule.parse(expression);
	if (isFailure(parsed)) return t("schedule.expression", { expression });

	let schedule = parsed.data;
	let descriptor = schedule.describe();

	switch (descriptor.kind) {
		case "interval":
			return t(`schedule.interval.${descriptor.unit}`, { count: descriptor.every });

		case "hourly":
			/**
			 * A schedule firing at minute 0 of every hour reads as "every hour"; naming the
			 * minute only helps when it isn't the top of the hour.
			 */
			if (descriptor.minutes.length === 1 && descriptor.minutes[0] === 0) {
				return t("schedule.hourly.onTheHour");
			}
			return t("schedule.hourly.atMinutes", {
				minutes: joinList(descriptor.minutes.map(String), locale),
			});

		case "daily":
			return t("schedule.daily", { times: joinTimes(descriptor.at, locale) });

		case "weekly":
			return t("schedule.weekly", {
				days: joinList(
					descriptor.weekdays.map((weekday) => weekdayName(weekday, locale)),
					locale,
				),
				times: joinTimes(descriptor.at, locale),
			});

		case "monthly":
			return t("schedule.monthly", {
				days: joinList(descriptor.days.map(String), locale),
				times: joinTimes(descriptor.at, locale),
			});

		case "yearly":
			return t("schedule.yearly", {
				months: joinList(
					descriptor.months.map((month) => monthName(month, locale)),
					locale,
				),
				days: joinList(descriptor.days.map(String), locale),
				times: joinTimes(descriptor.at, locale),
			});

		case "expression":
			return t("schedule.expression", { expression: schedule.toString() });
	}
}

/**
 * The message a visitor reads for an expression the parser rejected, keyed on the
 * failure's machine-readable reason so the wording lives in the locale files.
 *
 * @param error - The failure `Schedule.parse` returned.
 * @param t - The request's translator.
 * @returns The translated reason the expression was rejected.
 *
 * @example
 * invalidCronMessage(result.error, ctx.i18next.t);
 */
export function invalidCronMessage(error: InvalidCronExpression, t: TFunction): string {
	return t(`cron.error.${error.reason}`);
}

/**
 * Joins values the way the locale joins a list, so three weekdays read as a sentence
 * rather than as comma-separated data.
 *
 * @param values - The already-formatted items.
 * @param locale - Locale whose list conventions apply.
 * @returns The joined list.
 */
function joinList(values: readonly string[], locale: string): string {
	return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(values);
}

/**
 * Joins the times of day a schedule fires at, each as a zero-padded 24-hour clock
 * reading. Cron fields are wall-clock in the monitor's own zone, and the 24-hour form
 * is unambiguous in every language the app ships in.
 *
 * @param times - The times of day from a descriptor.
 * @param locale - Locale whose list conventions apply.
 * @returns The joined times, e.g. `"09:00 and 21:00"`.
 */
function joinTimes(times: readonly TimeOfDay[], locale: string): string {
	return joinList(
		times.map((time) => `${pad(time.hour)}:${pad(time.minute)}`),
		locale,
	);
}

/**
 * Two-digit clock reading for an hour or minute.
 *
 * @param value - The hour or minute.
 * @returns The value padded to two digits.
 */
function pad(value: number): string {
	return String(value).padStart(2, "0");
}

/**
 * The localized name of a weekday, indexed as the cron field is: `0` is Sunday.
 *
 * @param weekday - Weekday index from a descriptor.
 * @param locale - Locale the name comes from.
 * @returns The weekday's full name.
 *
 * @example
 * weekdayName(1, "es"); // "lunes"
 */
function weekdayName(weekday: number, locale: string): string {
	return new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long" }).format(
		new Date(WEEKDAY_ANCHOR_MS + weekday * MS_PER_DAY),
	);
}

/**
 * The localized name of a month, numbered as the cron field is: `1` is January.
 *
 * @param month - Month number from a descriptor.
 * @param locale - Locale the name comes from.
 * @returns The month's full name.
 *
 * @example
 * monthName(1, "de"); // "Januar"
 */
function monthName(month: number, locale: string): string {
	return new Intl.DateTimeFormat(locale, { timeZone: "UTC", month: "long" }).format(
		new Date(Date.UTC(2026, month - 1, 1)),
	);
}
