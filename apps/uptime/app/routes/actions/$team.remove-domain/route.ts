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

import type { Route } from "./+types/route";

const inputSchema = z.object({ domainId: z.uuid(), hostname: z.string() });

export async function action({ request, context }: Route.ActionArgs) {
	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.remove-domain.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.removeDomain.errors.generic") });
	}

	if (team().memberships[0].role === "member") {
		logger().info("action.remove-domain.forbidden", {
			teamId: team().id,
			reason: "member_role",
		});
		return forbidden({ message: t("actions.removeDomain.errors.notAllowed") });
	}

	let teamDomain = await db().query.teamDomains.findFirst({
		columns: { teamId: true, hostname: true, verifiedAt: true },
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, result.data.domainId),
				operators.eq(fields.teamId, team().id),
			);
		},
	});

	if (!teamDomain) {
		logger().info("action.remove-domain.not-found", {
			teamId: team().id,
			domainId: result.data.domainId,
		});
		return notFound({
			message: t("actions.removeDomain.errors.notFound", {
				hostname: result.data.hostname,
			}),
		});
	}

	await db().delete(schema.teamDomains).where(eq(schema.teamDomains.id, result.data.domainId));

	logger().info("action.remove-domain.success", {
		teamId: team().id,
		domainId: result.data.domainId,
		hostname: result.data.hostname,
	});

	return ok({
		message: t("actions.removeDomain.success", {
			team: team().name,
			hostname: result.data.hostname,
		}),
	});
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) toast.success(result.message);
	else toast.error(result.message);
	return result;
}
