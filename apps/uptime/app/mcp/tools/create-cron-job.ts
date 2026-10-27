/**
 * Answers `create_cron_job`: creates a cron-job monitor with a normalized schedule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Schedule } from "@sdxc/cron";
import { createTool, ToolError } from "@sdxc/mcp";
import { isFailure, unwrap } from "@sdxc/result";

import { forAbility } from "~/app/mcp/ability";
import { serializeCronJob } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";

/** Creates a cron-job monitor; the expression is stored normalized. */
export default createTool(toolset.createCronJob, {
	...forAbility(abilities.cronJobs.write),
	handler: async (ctx) => {
		let schedule = Schedule.parse(ctx.input.cronExpression);
		if (isFailure(schedule)) throw new ToolError(schedule.error.message);

		let cronJob = unwrap(
			await ctx.models.cronJobMonitors.create({
				team_id: ctx.apiTeam.id,
				name: ctx.input.name,
				description: ctx.input.description ?? null,
				cron_expression: schedule.data.toString(),
				grace_period_seconds: ctx.input.gracePeriodSeconds,
				timezone: ctx.input.timezone,
				alert_on_late: ctx.input.alertOnLate,
				enabled_at: ctx.input.enabled ? Date.now() : null,
			}),
		);
		return { cronJob: serializeCronJob(cronJob) };
	},
});
