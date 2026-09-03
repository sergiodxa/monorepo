/**
 * Form actions for team settings and membership: update/delete a team, and
 * remove/promote/demote a member. All require `requireRole("admin")`, which also
 * admits the owner (see `app/http/middleware/require-role.ts`). The owner keeps
 * their membership and role until the team itself is deleted.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { badRequest, notFound } from "@sdxc/http/response/html";
import { isFailure } from "@sdxc/result";
import { getServiceContainer } from "@sdxc/service-container";
import { validate } from "@sdxc/validate";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import Customer from "~/app/data/customer";
import Invite from "~/app/data/invite";
import Team from "~/app/data/team";
import {
	ChangeRoleSchema,
	DeleteTeamSchema,
	RemoveMemberSchema,
	UpdateTeamSchema,
} from "~/app/http/validators/team";
import routes from "~/routes/web";

/** POST /actions/:team/update-team */
export const updateTeam = createAction(routes.teamAdminActions.team.update, async (ctx) => {
	let result = await validate(ctx.formData, UpdateTeamSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", { intent: "error", message: "Please check the team details." });
		return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let { name, logo } = result.data;
	await Team.updateById(db, ctx.team.id, { name, logo: logo || null });

	session?.flash("toast", { intent: "success", message: "Team updated." });
	return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** DELETE /actions/:team/delete-team — owner-only in effect (checked here explicitly). */
export const deleteTeam = createAction(routes.teamAdminActions.team.delete, async (ctx) => {
	if (ctx.membership.subject_id !== ctx.team.owner_id) {
		return badRequest("Only the team owner can delete the team.");
	}

	let result = await validate(ctx.formData, DeleteTeamSchema);
	if (isFailure(result)) {
		return badRequest('Type "DELETE" to confirm.');
	}

	let db = getServiceContainer().get(Database);

	/**
	 * A refused cancellation is logged rather than raised: the team and its data go either
	 * way, and leaving a subscription running is recoverable from the platform's own dashboard
	 * while a half-deleted team is not.
	 */
	let cancelled = await Customer.cancelSubscriptions(ctx.billing, ctx.team.owner_id);

	if (isFailure(cancelled)) {
		ctx.logger.error("team.delete.cancel_failed", {
			code: cancelled.error.code,
			providerCode: cancelled.error.providerCode,
			connection: cancelled.error.connection,
			ownerId: ctx.team.owner_id,
		});
	}

	await Team.deleteById(db, ctx.team.id);

	return redirect(routes.home.href(), { status: redirect.Status.SeeOther });
});

/** DELETE /actions/:team/remove-member */
export const removeMember = createAction(routes.teamAdminActions.member.remove, async (ctx) => {
	let result = await validate(ctx.formData, RemoveMemberSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	if (result.data.subject_id === ctx.team.owner_id) {
		return badRequest("The team owner can't be removed.");
	}

	let db = getServiceContainer().get(Database);
	await Team.removeMembership(db, ctx.team.id, result.data.subject_id);
	await Invite.deleteByTeamAndEmail(db, ctx.team.id, result.data.email);

	session?.flash("toast", { intent: "success", message: "Member removed." });
	return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});

/** POST /actions/:team/change-role */
export const changeRole = createAction(routes.teamAdminActions.member.changeRole, async (ctx) => {
	let result = await validate(ctx.formData, ChangeRoleSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	if (result.data.subject_id === ctx.team.owner_id) {
		return badRequest("The team owner's role can't be changed.");
	}

	let db = getServiceContainer().get(Database);
	let membership = await Team.findMembership(db, ctx.team.id, result.data.subject_id);
	if (!membership) return notFound("Not Found");

	await Team.setRole(db, ctx.team.id, result.data.subject_id, result.data.role);

	session?.flash("toast", { intent: "success", message: "Role updated." });
	return redirect(routes.app.team.settings.href({ team: ctx.team.slug }), {
		status: redirect.Status.SeeOther,
	});
});
