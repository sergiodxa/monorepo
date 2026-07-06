/**
 * Route module for the team "check DNS monitor" action. Validates the monitor id,
 * verifies ownership by the current team, runs an on-demand DNS check via checkDns,
 * records the result and updates the monitor's last status/value. Exists so users can
 * manually trigger a DNS monitor evaluation outside its scheduled cadence.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, forbidden, notFound, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { eq } from "drizzle-orm";
import { toast } from "sonner";
import { z } from "zod/v4";

import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";
import { checkDns, type DnsRecordType } from "~/services/check-dns";

import type { Route } from "./+types/route";

const inputSchema = z.object({ dnsMonitorId: z.uuid() });

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "check-dns-monitor", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.check-dns-monitor.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.checkDnsMonitor.errors.generic") });
	}

	let dnsMonitor = await db().query.dnsMonitors.findFirst({
		where(fields, operators) {
			return operators.eq(fields.id, result.data.dnsMonitorId);
		},
	});

	if (!dnsMonitor) {
		logger().info("action.check-dns-monitor.not-found", {
			dnsMonitorId: result.data.dnsMonitorId,
		});
		return notFound({ message: t("actions.checkDnsMonitor.errors.notFound") });
	}

	if (dnsMonitor.teamId !== team().id) {
		logger().info("action.check-dns-monitor.forbidden", {
			dnsMonitorId: result.data.dnsMonitorId,
			dnsMonitorTeamId: dnsMonitor.teamId,
			requestTeamId: team().id,
		});
		return forbidden({
			message: t("actions.checkDnsMonitor.errors.forbidden"),
		});
	}

	// Perform the DNS check
	let checkResult = await checkDns(
		dnsMonitor.domain,
		dnsMonitor.recordType as DnsRecordType,
		dnsMonitor.expectedValue,
		dnsMonitor.lastValue,
	);

	// Store the result
	await db().insert(schema.dnsMonitorResults).values({
		dnsMonitorId: dnsMonitor.id,
		status: checkResult.status,
		resolvedValue: checkResult.resolvedValue,
		responseTimeMs: checkResult.responseTimeMs,
		errorMessage: checkResult.errorMessage,
		checkedAt: new Date(),
	});

	// Update the monitor with the latest status
	await db()
		.update(schema.dnsMonitors)
		.set({
			lastCheckedAt: new Date(),
			lastStatus: checkResult.status,
			lastValue: checkResult.resolvedValue,
		})
		.where(eq(schema.dnsMonitors.id, dnsMonitor.id));

	logger().info("action.check-dns-monitor.success", {
		teamId: team().id,
		dnsMonitorId: dnsMonitor.id,
		status: checkResult.status,
	});

	return ok({
		message: t("actions.checkDnsMonitor.success", { name: dnsMonitor.name }),
	});
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) {
		toast.success(result.message);
	} else {
		toast.error(result.message);
	}
	return result;
}
