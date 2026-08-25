/**
 * Public surface of the cron package: the `Schedule` value object, the failure
 * parsing returns, the descriptor shapes an app translates, and the option bags
 * every query takes, leaving descriptor-to-text formatting to the caller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type {
	DailyDescriptor,
	ExpressionDescriptor,
	HourlyDescriptor,
	IntervalDescriptor,
	MonthlyDescriptor,
	ScheduleDescriptor,
	WeeklyDescriptor,
	YearlyDescriptor,
} from "./describe";
export type { InvalidCronExpressionInput, InvalidCronReason } from "./invalid-cron-expression";
export type {
	CronFieldName,
	ExpectedByOptions,
	IsDueOptions,
	MatchOptions,
	NextOptions,
	OccurrenceOptions,
	TimeOfDay,
} from "./types";

export { InvalidCronExpression } from "./invalid-cron-expression";
export { Schedule } from "./schedule";
