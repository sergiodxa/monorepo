/**
 * Route module for the team "update team" action. Requires the subject to be an admin,
 * validates the team name and optional logo URL, and persists the changes to the teams
 * table. Exists so team admins can rename their team and set its logo, redirecting back
 * to the team settings page on success.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { badRequest, forbidden, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { eq } from "drizzle-orm";
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
	name: z.string().min(1).max(255),
	logo: z.union([z.url(), z.literal("")]).optional(),
});

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "update-team", method: request.method });

	let { t } = i18next(context);
	let teamData = team();

	// Check if user is admin
	let subjectMembership = teamData.memberships[0];
	if (subjectMembership.role !== "admin") {
		logger().info("action.update-team.forbidden", {
			teamId: teamData.id,
			role: subjectMembership.role,
		});
		return forbidden({ message: t("actions.updateTeam.errors.forbidden") });
	}

	let result = await validate(request, inputSchema);

	if (isFailure(result)) {
		logger().info("action.update-team.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.updateTeam.errors.generic") });
	}

	let [updatedTeam] = await db()
		.update(schema.teams)
		.set({
			name: result.data.name,
			logo: result.data.logo || null,
		})
		.where(eq(schema.teams.id, teamData.id))
		.returning();

	if (!updatedTeam) {
		logger().error("action.update-team.update-failed", {
			teamId: teamData.id,
		});
		return badRequest({ message: t("actions.updateTeam.errors.generic") });
	}

	logger().info("action.update-team.success", {
		teamId: teamData.id,
		name: updatedTeam.name,
		logo: updatedTeam.logo,
	});

	return ok({
		message: t("actions.updateTeam.success.updated"),
	});
}

export async function clientAction({ serverAction, params }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) {
		toast.success(result.message);
		return redirect(href("/app/:team/settings", params));
	}
	toast.error(result.message);
	return result;
}
