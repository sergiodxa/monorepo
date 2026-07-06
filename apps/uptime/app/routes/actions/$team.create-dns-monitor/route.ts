/**
 * Route action that creates a DNS monitor for a team. It validates the name, domain,
 * record type, expected value, and check interval, enforces a per-team limit of
 * twenty DNS monitors, and inserts the record. It exists so teams can watch DNS
 * records for changes, redirecting to the DNS page on success.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, created, unprocessableEntity } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { count, eq } from "drizzle-orm";
import { href, redirect } from "react-router";
import { toast } from "sonner";
import { z } from "zod/v4";

import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

const inputSchema = z.object({
	name: z.string().min(1, "Name is required"),
	domain: z.string().min(1, "Domain is required"),
	recordType: z.enum(["A", "AAAA", "CNAME", "MX", "TXT", "NS"]),
	expectedValue: z.string().optional(),
	intervalSeconds: z.coerce.number().min(300).max(86400).default(3600),
	isEnabled: z.literal("on").optional(),
});

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "create-dns-monitor", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.create-dns-monitor.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.createDnsMonitor.errors.generic") });
	}

	let [countResult] = await db()
		.select({ count: count() })
		.from(schema.dnsMonitors)
		.where(eq(schema.dnsMonitors.teamId, team().id));

	if ((countResult?.count ?? 0) >= 20) {
		logger().info("action.create-dns-monitor.limit-exceeded", {
			teamId: team().id,
			currentCount: countResult?.count ?? 0,
			limit: 20,
		});
		return unprocessableEntity({
			message: t("actions.createDnsMonitor.errors.limitExceeded", { limit: 20 }),
		});
	}

	let [dnsMonitor] = await db()
		.insert(schema.dnsMonitors)
		.values({
			teamId: team().id,
			name: result.data.name,
			domain: result.data.domain,
			recordType: result.data.recordType,
			expectedValue: result.data.expectedValue || null,
			intervalSeconds: result.data.intervalSeconds,
			isEnabled: result.data.isEnabled === "on",
		})
		.returning();

	if (!dnsMonitor) {
		logger().error("action.create-dns-monitor.insert-failed", {
			teamId: team().id,
			name: result.data.name,
		});
		return badRequest({ message: t("actions.createDnsMonitor.errors.generic") });
	}

	logger().info("action.create-dns-monitor.success", {
		teamId: team().id,
		dnsMonitorId: dnsMonitor.id,
		domain: result.data.domain,
		recordType: result.data.recordType,
	});

	return created({
		message: t("actions.createDnsMonitor.success.created", { name: dnsMonitor.name }),
	});
}

export async function clientAction({ serverAction, params }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) {
		toast.success(result.message);
		return redirect(href("/app/:team/dns", params));
	}
	toast.error(result.message);
	return result;
}
