import { badRequest, created, forbidden, ok } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env, waitUntil } from "cloudflare:workers";
import { toast } from "sonner";
import { z } from "zod/v4";

import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

const inputSchema = z.object({ domainId: z.uuid() });

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "retry-domain-verification", method: request.method });

	let result = await validate(request, inputSchema);
	let { t } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.retry-domain-verification.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({
			message: t("actions.retryDomainVerification.errors.generic"),
		});
	}

	if (team().memberships[0].role === "member") {
		logger().info("action.retry-domain-verification.forbidden", {
			teamId: team().id,
			reason: "member_role",
		});
		return forbidden({
			message: t("actions.retryDomainVerification.errors.notAllowed"),
		});
	}

	let teamDomain = await db().query.teamDomains.findFirst({
		columns: { id: true, teamId: true, hostname: true, verifiedAt: true },
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.id, result.data.domainId),
				operators.eq(fields.teamId, team().id),
			);
		},
	});

	if (!teamDomain) {
		logger().info("action.retry-domain-verification.not-found", {
			teamId: team().id,
			domainId: result.data.domainId,
		});
		return badRequest({
			message: t("actions.retryDomainVerification.errors.generic"),
		});
	}

	if (teamDomain.verifiedAt) {
		logger().info("action.retry-domain-verification.already-verified", {
			teamId: team().id,
			domainId: result.data.domainId,
		});
		return ok({
			message: t("actions.retryDomainVerification.success.alreadyVerified", {
				hostname: teamDomain.hostname,
				team: team().name,
			}),
		});
	}

	waitUntil(
		env.QUEUE.send({
			type: "verifyDomainOwnership",
			teamDomainId: teamDomain.id,
		}),
	);

	logger().info("action.retry-domain-verification.requested", {
		teamId: team().id,
		domainId: teamDomain.id,
		hostname: teamDomain.hostname,
	});

	return created({
		message: t("actions.retryDomainVerification.success.requested", {
			hostname: teamDomain.hostname,
			team: team().name,
		}),
	});
}

export async function clientAction({ serverAction }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) toast.success(result.message);
	else toast.error(result.message);
	return result;
}
