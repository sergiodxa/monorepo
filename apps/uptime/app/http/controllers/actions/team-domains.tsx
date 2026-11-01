/**
 * Form actions for adding, removing, and retrying verification of team domains.
 * Requires `requireAbility(abilities.domains.write)`. Adding/retrying enqueues a `verifyDomainOwnership`
 * message immediately, ahead of the periodic sweep.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { notFound } from "@sdxc/http/response/html";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { waitUntil } from "cloudflare:workers";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import type { FormSubmission } from "~/app/http/validators/form-submission";

import { Admin } from "~/app/http/middleware/admin";
import {
	AddDomainSchema,
	RemoveDomainSchema,
	RetryDomainVerificationSchema,
} from "~/app/http/validators/team-domain";
import { createManagementClient } from "~/app/initializers/management-client";
import jobs from "~/app/jobs";
import { loadTeamSettings } from "~/app/services/team-settings";
import TeamSettingsPage from "~/resources/views/settings/settings-page";
import routes from "~/routes/web";

/**
 * POST /actions/:team/add-domain. A refused hostname draws the settings page again, answered as
 * 422, with the add-domain dialog open on the typed hostname and its error.
 */
export const addDomain = createAction(routes.teamAdminActions.domain.add, async (ctx) => {
	let result = await validate(ctx.formData, AddDomainSchema);
	let session = ctx.get(Session);

	/** Draws the settings page again with the add-domain dialog open on the refused hostname. */
	let sendBack = async (message: string) => {
		if (!ctx.has(Admin)) ctx.set(Admin, createManagementClient(), { property: "admin" });
		let settings = await loadTeamSettings(ctx.models, ctx.admin, ctx.team);
		let submission: FormSubmission = {
			values: ctx.formData,
			issues: [{ message, path: ["hostname"] }],
		};
		return ctx.render(<TeamSettingsPage settings={settings} domainSubmission={submission} />, {
			status: 422,
		});
	};

	if (isFailure(result)) {
		return sendBack(ctx.intl.t("actions.addDomain.errors.invalidHostname"));
	}

	let { hostname } = result.data;

	let existing = await ctx.models.teamDomains.inTeam(ctx.team.id).where({ hostname }).first();
	if (existing && existing.verified_at !== null) {
		return sendBack(ctx.intl.t("actions.addDomain.errors.alreadyVerified", { hostname }));
	}

	/** A new domain queues its own verification once written; a pending one is retried here. */
	if (existing) {
		waitUntil(ctx.jobs.enqueue(jobs.verifyDomainOwnership, { teamDomainId: existing.id }));
	} else {
		unwrap(await ctx.models.teamDomains.create({ team_id: ctx.team.id, hostname }));
	}

	session?.flash("toast", {
		intent: "success",
		message: existing
			? ctx.intl.t("actions.addDomain.success.accepted", { hostname })
			: ctx.intl.t("actions.addDomain.success.created", { hostname, team: ctx.team.name }),
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

	session?.flash("toast", {
		intent: "success",
		message: ctx.intl.t("actions.removeDomain.success", {
			hostname: domain.hostname,
			team: ctx.team.name,
		}),
	});
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

		session?.flash("toast", {
			intent: "success",
			message: ctx.intl.t(
				domain.verified_at === null
					? "actions.retryDomainVerification.success.requested"
					: "actions.retryDomainVerification.success.alreadyVerified",
				{ hostname: domain.hostname },
			),
		});
		return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	},
);
