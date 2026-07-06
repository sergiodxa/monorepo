/**
 * Route module for the team "add domain" action. Validates the hostname, requires a
 * non-member role, avoids duplicate or already-verified entries, inserts a pending
 * team domain, and enqueues an ownership-verification job on the Cloudflare queue.
 * Exists so teams can attach a custom domain and kick off its verification flow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Location } from "@pkg/location";
import { accepted, badRequest, created, forbidden } from "@pkg/response";
import { isFailure } from "@pkg/result";
import { validate } from "@pkg/validate";
import { env, waitUntil } from "cloudflare:workers";
import { href, redirect } from "react-router";
import { toast } from "sonner";
import { z } from "zod/v4";

import * as schema from "~/db/schema";
import { db } from "~/middleware/drizzle";
import { i18next } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

const inputSchema = z.object({ hostname: z.string() });

export async function action({ request, context }: Route.ActionArgs) {
	logger().info("action.start", { route: "add-domain", method: request.method });

	let result = await validate(request, inputSchema);
	let { t, language } = i18next(context);

	if (isFailure(result)) {
		logger().info("action.add-domain.validation-failed", {
			issues: result.error.issues,
		});
		return badRequest({ message: t("actions.addDomain.errors.generic") });
	}

	if (team().memberships[0].role === "member") {
		logger().info("action.add-domain.forbidden", {
			teamId: team().id,
			reason: "member_role",
		});
		return forbidden({
			message: t("actions.addDomain.errors.notAllowed"),
		});
	}

	let teamDomain = await db().query.teamDomains.findFirst({
		columns: { id: true, teamId: true, hostname: true, verifiedAt: true },
		where(fields, operators) {
			return operators.and(
				operators.eq(fields.hostname, result.data.hostname),
				operators.eq(fields.teamId, team().id),
			);
		},
	});

	if (teamDomain) {
		if (teamDomain.verifiedAt === null) {
			logger().info("action.add-domain.already-pending", {
				teamId: team().id,
				hostname: result.data.hostname,
			});
			return accepted({
				message: t("actions.addDomain.success.accepted", result.data),
			});
		}

		logger().info("action.add-domain.already-exists", {
			teamId: team().id,
			hostname: teamDomain.hostname,
		});
		return badRequest({
			message: t("actions.addDomain.errors.alreadyExists", {
				hostname: teamDomain.hostname,
				verifiedAt: teamDomain.verifiedAt.toLocaleString(language, {
					dateStyle: "short",
				}),
			}),
		});
	}

	[teamDomain] = await db()
		.insert(schema.teamDomains)
		.values({
			teamId: team().id,
			hostname: result.data.hostname,
		})
		.returning();

	if (!teamDomain) {
		logger().error("action.add-domain.insert-failed", {
			teamId: team().id,
			hostname: result.data.hostname,
		});
		return badRequest({ message: t("actions.addDomain.errors.generic") });
	}

	waitUntil(
		env.QUEUE.send({
			type: "verifyDomainOwnership",
			teamDomainId: teamDomain.id,
		}),
	);

	logger().info("action.add-domain.success", {
		teamId: team().id,
		teamDomainId: teamDomain.id,
		hostname: teamDomain.hostname,
	});

	return created({
		message: t("actions.addDomain.success.created", {
			hostname: teamDomain.hostname,
			team: team().name,
		}),
	});
}

export async function clientAction({ serverAction, params }: Route.ClientActionArgs) {
	let result = await serverAction();
	if (result.ok) {
		toast.success(result.message);
		let location = new Location({ pathname: href("/app/:team/settings", params), hash: "domains" });
		return redirect(location.toString());
	}
	toast.error(result.message);
	return result;
}
