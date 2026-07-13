/**
 * Form actions for a monitor's content checks: create (capped at 10 per monitor,
 * regex patterns validated at creation time) and delete.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@pkg/http/response";
import { notFound, unprocessableEntity } from "@pkg/http/response/html";
import { isFailure } from "@pkg/result";
import { getServiceContainer } from "@pkg/service-container";
import { validate } from "@pkg/validate";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";
import { Session } from "remix/session";

import ContentCheck from "~/app/data/content-check";
import Monitor from "~/app/data/monitor";
import {
	CreateContentCheckSchema,
	DeleteContentCheckSchema,
} from "~/app/http/validators/content-check";
import { monitorContentChecks } from "~/database/schema";
import routes from "~/routes/web";

const MAX_CONTENT_CHECKS_PER_MONITOR = 10;

/** POST /actions/:team/create-content-check */
export const createContentCheck = createAction(routes.actions.createContentCheck, async (ctx) => {
	let result = await validate(ctx.formData, CreateContentCheckSchema);
	let session = ctx.get(Session);

	if (isFailure(result)) {
		session?.flash("toast", {
			intent: "error",
			message: "Please check the content check and try again.",
		});
		return redirect(routes.app.team.dashboard.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let { monitor_id, type, value, case_sensitive } = result.data;

	let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, monitor_id);
	if (!monitor) return notFound("Not Found");

	let existingCount = await db.count(monitorContentChecks, { where: { monitor_id } });
	if (existingCount >= MAX_CONTENT_CHECKS_PER_MONITOR) {
		return unprocessableEntity("A monitor supports at most 10 content checks.");
	}

	await db.create(
		monitorContentChecks,
		{
			id: crypto.randomUUID(),
			monitor_id,
			type,
			value,
			case_sensitive,
			is_enabled: true,
		},
		{ touch: true, returnRow: true },
	);

	session?.flash("toast", { intent: "success", message: "Content check added." });
	return redirect(
		routes.app.team.monitors.edit.href({ team: ctx.team.slug, monitorId: monitor_id }),
		{
			status: redirect.Status.SeeOther,
		},
	);
});

/** DELETE /actions/:team/delete-content-check */
export const deleteContentCheck = createAction(routes.actions.deleteContentCheck, async (ctx) => {
	let result = await validate(ctx.formData, DeleteContentCheckSchema);

	if (isFailure(result)) {
		return redirect(routes.app.team.dashboard.index.href({ team: ctx.team.slug }), {
			status: redirect.Status.SeeOther,
		});
	}

	let db = getServiceContainer().get(Database);
	let { monitor_id, content_check_id } = result.data;

	let monitor = await Monitor.findByIdForTeam(db, ctx.team.id, monitor_id);
	if (!monitor) return notFound("Not Found");

	let check = await ContentCheck.findByIdForMonitor(db, monitor_id, content_check_id);
	if (!check) return notFound("Not Found");

	await db.delete(monitorContentChecks, content_check_id);

	ctx.get(Session)?.flash("toast", { intent: "success", message: "Content check removed." });
	return redirect(
		routes.app.team.monitors.edit.href({ team: ctx.team.slug, monitorId: monitor_id }),
		{
			status: redirect.Status.SeeOther,
		},
	);
});
