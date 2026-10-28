/**
 * Answers `update_cron_job`: updates a cron-job monitor (PUT-equivalent body).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Schedule } from "@sdxc/cron";
import { createTool, ToolError } from "@sdxc/mcp/server";
import { isFailure, unwrap } from "@sdxc/result";

import type { InsertCronJobMonitor } from "~/database/schema";

import { forAbility } from "~/app/mcp/ability";
import { serializeCronJob } from "~/app/mcp/serialize";
import toolset from "~/app/mcp/tools";
import { calculateNextExpected } from "~/app/models/cron-job-monitors";
import abilities from "~/app/policies/abilities";

/** Updates a cron-job monitor; changing the schedule recomputes nextExpectedAt. */
export default createTool(toolset.updateCronJob, {
	...forAbility(abilities.cronJobs.write),
	handler: async (ctx) => {
		let { cronJobId, ...fields } = ctx.input;
		let existing = await ctx.models.cronJobMonitors
			.inTeam(ctx.apiTeam.id)
			.where({ id: cronJobId })
			.first();
		if (!existing) throw new ToolError("Cron job not found");

		let changes: Partial<InsertCronJobMonitor> = {};
		if (fields.name !== undefined) changes.name = fields.name;
		if (fields.description !== undefined) changes.description = fields.description;
		if (fields.gracePeriodSeconds !== undefined)
			changes.grace_period_seconds = fields.gracePeriodSeconds;
		if (fields.timezone !== undefined) changes.timezone = fields.timezone;
		if (fields.alertOnLate !== undefined) changes.alert_on_late = fields.alertOnLate;
		if (fields.enabled !== undefined) changes.enabled_at = fields.enabled ? Date.now() : null;

		if (fields.cronExpression !== undefined) {
			let timezone = fields.timezone ?? existing.timezone;
			let schedule = Schedule.parse(fields.cronExpression);
			if (isFailure(schedule)) throw new ToolError(schedule.error.message);
			changes.cron_expression = schedule.data.toString();
			changes.next_expected_at = calculateNextExpected(changes.cron_expression, timezone);
		} else if (fields.timezone !== undefined && fields.timezone !== existing.timezone) {
			changes.next_expected_at = calculateNextExpected(existing.cron_expression, fields.timezone);
		}

		let cronJob = unwrap(await ctx.models.cronJobMonitors.update(cronJobId, changes));
		return { cronJob: serializeCronJob(cronJob) };
	},
});
