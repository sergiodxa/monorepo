/**
 * Shared create path for the five MCP alert tools that mirror `POST /api/v1/alerts`'
 * strategy arms — one tool each, because MCP tool inputs must be a root object.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyRequestContext } from "@sdxc/mcp";

import { ToolError } from "@sdxc/mcp";
import { unwrap } from "@sdxc/result";

import type { CreateAlertValues } from "~/app/http/controllers/api/alerts";
import type { MonitorScopeType } from "~/app/services/monitor-scope";

import { apiScopeFrom, buildConfig } from "~/app/http/controllers/api/alerts";
import { serializeAlertStrategyOnly } from "~/app/mcp/serialize";
import { MAX_ALERTS_PER_TEAM } from "~/app/models/alerts";
import { refuseUndeliverableRecipient } from "~/app/services/email-address";
import { isResolvableScope } from "~/app/services/scope-monitors";

/** Common fields every create-alert tool carries beside its channel settings. */
interface AlertCommonFields {
	name: string;
	notifyOnRecovery: boolean;
	cooldownMinutes: number;
	monitorType?: MonitorScopeType;
	monitorId?: string;
}

/** One create-alert tool's full input: channel arm plus the shared alert fields. */
type CreateAlertToolInput = CreateAlertValues & AlertCommonFields;

/**
 * Creates an alert for one fixed strategy, with the same scope and deliverability checks
 * as the REST create.
 *
 * @param ctx - The authenticated MCP request.
 * @param values - The strategy arm's values, including the literal `strategy` discriminant.
 */
export async function createAlertForStrategy(ctx: AnyRequestContext, values: CreateAlertToolInput) {
	let existingCount = await ctx.models.alerts.inTeam(ctx.apiTeam.id).count();
	if (existingCount >= MAX_ALERTS_PER_TEAM) {
		throw new ToolError(`Maximum of ${MAX_ALERTS_PER_TEAM} alerts per team`);
	}

	let scope = apiScopeFrom(values);
	if (scope === null || !(await isResolvableScope(ctx.models, ctx.apiTeam.id, scope))) {
		throw new ToolError("Monitor not found");
	}

	if (values.strategy === "email") {
		let undeliverable = await refuseUndeliverableRecipient(values.email, "/email");
		if (undeliverable) throw new ToolError("That email address cannot receive mail.");
	}

	let alert = await ctx.models.alerts.create({
		team_id: ctx.apiTeam.id,
		name: values.name,
		monitor_type: scope.monitorType,
		monitor_id: scope.monitorId,
		notify_on_recovery: values.notifyOnRecovery,
		cooldown_minutes: values.cooldownMinutes,
		config: buildConfig(values),
	});

	return { alert: serializeAlertStrategyOnly(unwrap(alert)) };
}
