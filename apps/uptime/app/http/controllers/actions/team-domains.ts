/**
 * Form actions for adding, removing, and retrying verification of team domains.
 * Requires `requireRole("admin")`. Adding/retrying enqueues a `verifyDomainOwnership`
 * message immediately, ahead of the periodic sweep.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { badRequest, notFound } from "@sdxc/http/response/html";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { waitUntil } from "cloudflare:workers";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import {
	AddDomainSchema,
	RemoveDomainSchema,
	RetryDomainVerificationSchema,
} from "~/app/http/validators/team-domain";
import jobs from "~/app/jobs";
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

	let { hostname } = result.data;

	let existing = await ctx.models.teamDomains.inTeam(ctx.team.id).where({ hostname }).first();
	if (existing && existing.verified_at !== null) {
		return badRequest(`${hostname} is already verified for this team.`);
	}

	/** A new domain queues its own verification once written; a pending one is retried here. */
	if (existing) {
		waitUntil(ctx.jobs.enqueue(jobs.verifyDomainOwnership, { teamDomainId: existing.id }));
	} else {
		unwrap(await ctx.models.teamDomains.create({ team_id: ctx.team.id, hostname }));
	}

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

	let domain = await ctx.models.teamDomains
		.inTeam(ctx.team.id)
		.where({ id: result.data.domain_id })
		.first();
	if (!domain) return notFound("Not Found");

	unwrap(await ctx.models.teamDomains.delete(domain.id));

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

		let domain = await ctx.models.teamDomains
			.inTeam(ctx.team.id)
			.where({ id: result.data.domain_id })
			.first();
		if (!domain) return notFound("Not Found");

		if (domain.verified_at === null) {
			waitUntil(ctx.jobs.enqueue(jobs.verifyDomainOwnership, { teamDomainId: domain.id }));
		}

		session?.flash("toast", { intent: "success", message: "Verification retried." });
		return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	},
);
