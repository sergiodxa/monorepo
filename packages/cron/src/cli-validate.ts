/**
 * The `validate` handler: parses an expression with `Schedule.parse` and reports either its
 * normalized form or the reason, field and position it was rejected at, so CI can check a
 * schedule before it is stored or deployed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { CRON_COMMANDS } from "./cli-contract.js";
import { describeInvalid, invalidReport, loadSchedule } from "./cli-input.js";
import { InvalidCronExpression } from "./invalid-cron-expression.js";

/**
 * Exits 0 printing the normalized expression, 1 when the expression is invalid (the diagnostic
 * on stderr, or the report on stdout with `--json`), and 2 when there is no expression to read.
 */
export default createCommand(CRON_COMMANDS.validate, async (ctx) => {
	let loaded = await loadSchedule(ctx.arguments.expression, ctx.stdin);
	if (isFailure(loaded)) {
		if (!(loaded.error instanceof InvalidCronExpression)) return exit(2, loaded.error.message);
		if (ctx.flags.json) {
			ctx.stdout(`${JSON.stringify(invalidReport(loaded.error), null, 2)}\n`);
		} else {
			ctx.stderr(describeInvalid(loaded.error));
		}
		return exit(1);
	}
	let { expression, schedule } = loaded.data;
	if (ctx.flags.json) {
		let report = { valid: true, expression, normalized: schedule.toString() };
		ctx.stdout(`${JSON.stringify(report, null, 2)}\n`);
	} else {
		ctx.stdout(`Valid: ${schedule.toString()}\n`);
	}
	return success();
});
