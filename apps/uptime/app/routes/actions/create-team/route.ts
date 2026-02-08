import { badRequest, created } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { href, redirect } from "react-router";
import { toast } from "sonner";
import { z } from "zod/v4";

import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { subject } from "~/middleware/subject";

import type { Route } from "./+types/route";

const inputSchema = z.object({
	name: z.string().min(1).max(255),
});

function generateSlug(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, "")
		.replace(/\s+/g, "-")
		.replace(/-+/g, "-")
		.slice(0, 50);
}

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "create-team", method: request.method });

	let { t } = i18next(context);
	let subjectData = subject();

	let result = await validate(request, inputSchema);

	if (isFailure(result)) {
		logger().info("action.create-team.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.createTeam.errors.generic") });
	}

	let slug = generateSlug(result.data.name);

	// Check if slug already exists
	let existingTeam = await db().query.teams.findFirst({
		where(fields, operators) {
			return operators.eq(fields.slug, slug);
		},
	});

	if (existingTeam) {
		// Append a random suffix to make it unique
		slug = `${slug}-${Date.now().toString(36)}`;
	}

	let [team] = await db()
		.insert(schema.teams)
		.values({
			ownerId: subjectData.id,
			name: result.data.name,
			slug,
			logo: subjectData.avatar || null,
		})
		.returning();

	if (!team) {
		logger().error("action.create-team.insert-failed", {
			subjectId: subjectData.id,
			name: result.data.name,
		});
		return badRequest({ message: t("actions.createTeam.errors.generic") });
	}

	// Create membership for the owner
	await db().insert(schema.memberships).values({
		subjectId: subjectData.id,
		teamId: team.id,
		role: "admin",
	});

	logger().info("action.create-team.success", {
		subjectId: subjectData.id,
		teamId: team.id,
		teamName: team.name,
		teamSlug: team.slug,
	});

	return created({
		message: t("actions.createTeam.success.created", { name: team.name }),
		teamSlug: team.slug,
	});
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok && "teamSlug" in result && typeof result.teamSlug === "string") {
		toast.success(result.message);
		return redirect(href("/app/:team/dashboard", { team: result.teamSlug }));
	}
	if (!result.ok) {
		toast.error(result.message);
	}
	return result;
}
