/**
 * Answers `cron_job_ping`: reports that a cron job ran (its heartbeat), matching
 * POST /api/v1/cron-jobs/:cronJobId/ping without the HTTP caller rate-limit middleware.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTool, ToolError } from "@sdxc/mcp";
import { waitUntil } from "cloudflare:workers";

import { forAbility } from "~/app/mcp/ability";
import toolset from "~/app/mcp/tools";
import abilities from "~/app/policies/abilities";
import { notifyCronJobResult } from "~/app/services/alerts/dispatch";
import { writePingResult } from "~/app/services/analytics";
import { ingestPings } from "~/app/services/ping-meter";
import { decodeIdOrUUID } from "~/app/services/typed-id";

/** Minimum time between accepted pings for one monitor. */
const RATE_LIMIT_MS = 30_000;

/** Reports that a cron job ran; enforces the per-monitor 30-second floor. */
export default createTool(toolset.cronJobPing, {
	...forAbility(abilities.cronJobs.ping),
	handler: async (ctx) => {
		let cronJobId = decodeIdOrUUID("cron", ctx.input.cronJobId);
		if (cronJobId === null) throw new ToolError("Cron job not found");

		let monitor = await ctx.models.cronJobMonitors.inTeam(ctx.apiTeam.id).find(cronJobId);
		if (!monitor) throw new ToolError("Cron job not found");

		ctx.log.set({ monitor: { id: monitor.id, type: "cron" } });

		if (monitor.enabled_at === null) throw new ToolError("Cron job is disabled");

		if (monitor.last_ping_at !== null && Date.now() - monitor.last_ping_at < RATE_LIMIT_MS) {
			let retryAfter = Math.ceil((RATE_LIMIT_MS - (Date.now() - monitor.last_ping_at)) / 1000);
			throw new ToolError(
				`Rate limit exceeded. Max 1 ping every 30 seconds. Retry after ${retryAfter}s.`,
			);
		}

		let deadline =
			monitor.next_expected_at === null
				? null
				: monitor.next_expected_at + monitor.grace_period_seconds * 1000;
		let wasOnTime = deadline === null || Date.now() <= deadline;

		let pingId = await ctx.models.cronJobMonitors.recordPing(monitor, wasOnTime, {
			sourceIp: ctx.ip?.toString() ?? null,
			userAgent: ctx.request.headers.get("User-Agent"),
		});

		writePingResult({
			monitorId: monitor.id,
			teamId: monitor.team_id,
			type: "cron",
			status: wasOnTime ? "up" : "degraded",
			responseTimeMs: 0,
		});

		let ownerIds = await ctx.models.teams.ownerIdsByTeamIds([monitor.team_id]);
		let ownerId = ownerIds.get(monitor.team_id);
		if (ownerId === undefined) {
			ctx.log.warn("team.unbillable");
		} else {
			waitUntil(
				ingestPings(ctx.billing, [
					{
						externalId: `ping:${pingId}`,
						ownerId,
						teamId: monitor.team_id,
						monitorId: monitor.id,
						type: "cron",
					},
				]),
			);
		}

		await notifyCronJobResult(
			ctx.models,
			ctx.email,
			monitor,
			monitor.status,
			wasOnTime ? "healthy" : "late",
		);

		return { wasOnTime };
	},
});
