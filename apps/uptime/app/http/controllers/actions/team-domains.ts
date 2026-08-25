/**
 * Form actions for adding, removing, and retrying verification of team domains.
 * Requires `requireRole("admin")`. Adding/retrying enqueues a `verifyDomainOwnership`
 * message immediately, ahead of the periodic sweep.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { badRequest, notFound } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { waitUntil } from "cloudflare:workers";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import TeamDomain from "~/app/data/team-domain";
import {
	AddDomainSchema,
	RemoveDomainSchema,
	RetryDomainVerificationSchema,
} from "~/app/http/validators/team-domain";
import { sendQueueMessage } from "~/app/lib/queue";
import routes from "~/routes/web";

/** POST /actions/:team/add-domain */
export const addDomain = createAction(routes.teamAdminActions.domain.add, async (ctx) => {
	let result = await validate(ctx.formData, AddDomainSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", { intent: "error", message: "Enter a valid domain." });
		return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let { hostname } = result.data;

	let existing = await TeamDomain.findByHostnameForTeam(db, ctx.team.id, hostname);
	if (existing && existing.verified_at !== null) {
		return badRequest(`${hostname} is already verified for this team.`);
	}

	let domain = existing ?? (await TeamDomain.create(db, ctx.team.id, hostname));
	waitUntil(sendQueueMessage({ type: "verifyDomainOwnership", teamDomainId: domain.id }));

	session?.flash("toast", {
		intent: "success",
		message: `Add a TXT record at _ping-verification.${hostname} to verify it.`,
	});
	return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** DELETE /actions/:team/remove-domain */
export const removeDomain = createAction(routes.teamAdminActions.domain.remove, async (ctx) => {
	let result = await validate(ctx.formData, RemoveDomainSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let domain = await TeamDomain.findByIdForTeam(db, ctx.team.id, result.data.domain_id);
	if (!domain) return notFound("Not Found");

	await TeamDomain.deleteById(db, domain.id);

	session?.flash("toast", { intent: "success", message: `${domain.hostname} removed.` });
	return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** POST /actions/:team/retry-domain-verification */
export const retryDomainVerification = createAction(
	routes.teamAdminActions.domain.retryVerification,
	async (ctx) => {
		let result = await validate(ctx.formData, RetryDomainVerificationSchema);
		let session = ctx.get(Session);

		if (isFailure(result)) {
			return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
				status: redirect.Status.SeeOther,
			});
		}

		let db = getServiceContainer().get(Database);
		let domain = await TeamDomain.findByIdForTeam(db, ctx.team.id, result.data.domain_id);
		if (!domain) return notFound("Not Found");

		if (domain.verified_at === null) {
			waitUntil(sendQueueMessage({ type: "verifyDomainOwnership", teamDomainId: domain.id }));
		}

		session?.flash("toast", { intent: "success", message: "Verification retried." });
		return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	},
);
