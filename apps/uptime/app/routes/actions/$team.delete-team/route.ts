/**
 * Route module for the team "delete team" action. Requires the caller to be the team
 * owner and a typed DELETE confirmation, then cancels any active Polar subscription,
 * cascades deletes across monitor results, alerts, monitors, domains, invites and
 * memberships, and finally removes the team. Exists to fully tear down a team account.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, forbidden, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { eq, inArray } from "drizzle-orm";
import { href, redirect } from "react-router";
import { toast } from "sonner";
import { z } from "zod/v4";

import polar from "~/clients/polar";
import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { subject } from "~/middleware/subject";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

const PRODUCT_ID = "94161883-14eb-42e2-bb26-b4647199cda1";

const inputSchema = z.object({
	confirmation: z.literal("DELETE"),
});

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "delete-team", method: request.method });

	let { t } = i18next(context);
	let teamData = team();
	let subjectData = subject();

	// Only the owner can delete the team
	if (subjectData.id !== teamData.ownerId) {
		logger().info("action.delete-team.forbidden", {
			teamId: teamData.id,
			subjectId: subjectData.id,
			ownerId: teamData.ownerId,
		});
		return forbidden({ message: t("actions.deleteTeam.errors.forbidden") });
	}

	let result = await validate(request, inputSchema);

	if (isFailure(result)) {
		logger().info("action.delete-team.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({
			message: t("actions.deleteTeam.errors.confirmationRequired"),
			issues: { confirmation: t("actions.deleteTeam.errors.confirmationRequired") },
		});
	}

	try {
		// 1. Cancel any active subscriptions
		let subscriptions = await polar.subscriptions.list({
			externalCustomerId: teamData.ownerId,
			active: true,
		});

		for (let subscription of subscriptions.result.items) {
			if (subscription.productId === PRODUCT_ID) {
				await polar.subscriptions.revoke({ id: subscription.id });
				logger().info("action.delete-team.subscription-revoked", {
					teamId: teamData.id,
					subscriptionId: subscription.id,
				});
			}
		}

		// 2. Get all monitor IDs for this team
		let monitors = await db().query.monitors.findMany({
			columns: { id: true },
			where: eq(schema.monitors.teamId, teamData.id),
		});

		let monitorIds = monitors.map((m) => m.id);

		// 3. Delete all related data in order
		if (monitorIds.length > 0) {
			// Delete monitor results
			await db()
				.delete(schema.monitorResults)
				.where(inArray(schema.monitorResults.monitorId, monitorIds));

			// Delete alerts
			await db().delete(schema.alerts).where(eq(schema.alerts.teamId, teamData.id));

			// Delete monitors
			await db().delete(schema.monitors).where(eq(schema.monitors.teamId, teamData.id));
		}

		// Delete team domains
		await db().delete(schema.teamDomains).where(eq(schema.teamDomains.teamId, teamData.id));

		// Delete invites
		await db().delete(schema.invites).where(eq(schema.invites.teamId, teamData.id));

		// Delete memberships
		await db().delete(schema.memberships).where(eq(schema.memberships.teamId, teamData.id));

		// 4. Delete the team
		await db().delete(schema.teams).where(eq(schema.teams.id, teamData.id));

		logger().info("action.delete-team.success", {
			teamId: teamData.id,
			teamName: teamData.name,
		});

		return ok({ message: t("actions.deleteTeam.success", { team: teamData.name }) });
	} catch (error) {
		logger().error("action.delete-team.error", {
			teamId: teamData.id,
			error: error instanceof Error ? error.message : String(error),
		});
		return badRequest({ message: t("actions.deleteTeam.errors.generic") });
	}
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) {
		toast.success(result.message);
		// Redirect to home after team deletion
		return redirect(href("/"));
	}
	toast.error(result.message);
	return result;
}
