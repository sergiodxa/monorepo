/**
 * Form actions for team settings and membership: update/delete a team, and
 * remove/promote/demote a member. All require `requireRole("admin")`, which also
 * admits the owner (see `app/http/middleware/require-role.ts`). The owner can never
 * be removed or have their role changed — they're demoted/removed only by deleting
 * the team itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { badRequest, notFound } from "@pkg/http/response/html";
import { PolarClient } from "@pkg/polar";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
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
	let polar = getServiceContainer().get(PolarClient);

	await Customer.cancelSubscriptions(polar, ctx.team.owner_id);
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
