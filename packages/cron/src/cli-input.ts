/**
 * What every `sdxc-cron` command shares: reading the expression from its argument or stdin,
 * parsing it into a `Schedule`, and the diagnostic that points a caret at the character a
 * rejected expression went wrong at.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { HandlerContext } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { failure, isFailure, success } from "@sdxc/result";

import type { CRON_COMMANDS } from "./cli-contract.js";
import type { InvalidCronExpression } from "./invalid-cron-expression.js";

import { Schedule } from "./schedule.js";

/** The stdin every command reads a `-` expression from. */
type Stdin = HandlerContext<typeof CRON_COMMANDS.validate>["stdin"];

/**
 * The expression as typed, or stdin's text trimmed for `-`; a terminal on stdin is unreadable,
 * so a command never waits on a person typing.
 *
 * @param value - The argument as typed
 * @param stdin - The run's stdin
 */
async function readExpression(value: string, stdin: Stdin): Promise<Result<string, Error>> {
	if (value !== "-") return success(value);
	if (stdin.isTTY) return failure(new Error("No expression: pass one quoted, or pipe it on stdin"));
	return success((await stdin.text()).trim());
}

/**
 * The schedule an argument names, or why there is none: an `InvalidCronExpression` for text
 * that is not a schedule, any other error for input that could not be read.
 *
 * @param value - The argument as typed
 * @param stdin - The run's stdin, read when `value` is `-`
 * @returns The schedule plus the expression it was parsed from
 */
export async function loadSchedule(
	value: string,
	stdin: Stdin,
): Promise<Result<{ expression: string; schedule: Schedule }, Error>> {
	let read = await readExpression(value, stdin);
	if (isFailure(read)) return read;
	let parsed = Schedule.parse(read.data);
	if (isFailure(parsed)) return parsed;
	return success({ expression: read.data, schedule: parsed.data });
}

/**
 * The lines a person reads for a rejected expression: the reason and field, then the expression
 * with a caret under `position`.
 *
 * @param error - The failure parsing answered
 * @example
 * describeInvalid(error); // "Invalid cron expression: out-of-range in the hour field\n  0 25 * * *\n    ^\n"
 */
export function describeInvalid(error: InvalidCronExpression): string {
	let where = error.field === null ? "" : ` in the ${error.field} field`;
	let caret = `${" ".repeat(error.position)}^`;
	return `Invalid cron expression: ${error.reason}${where}\n  ${error.expression}\n  ${caret}\n`;
}

/**
 * The stable JSON shape of a rejected expression, as `validate --json` prints it.
 *
 * @param error - The failure parsing answered
 */
export function invalidReport(error: InvalidCronExpression) {
	return {
		valid: false,
		expression: error.expression,
		reason: error.reason,
		field: error.field,
		position: error.position,
	};
}
