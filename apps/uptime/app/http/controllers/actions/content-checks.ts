/**
 * Form actions for a monitor's content checks: create (capped at 10 per monitor,
 * regex patterns validated at creation time) and delete.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { notFound, unprocessableEntity } from "@sdxc/http/response/html";
import { isFailure, unwrap } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import { createAction } from "remix/router";
import { Session } from "remix/session";

import {
	CreateContentCheckSchema,
	DeleteContentCheckSchema,
} from "~/app/http/validators/content-check";
import routes from "~/routes/web";

const MAX_CONTENT_CHECKS_PER_MONITOR = 10;

/** POST /actions/:team/create-content-check */
export const createContentCheck = createAction(
	routes.actions.monitor.http.createContentCheck,
	async (ctx) => {
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

		let { monitor_id, type, value, case_sensitive } = result.data;

		let monitor = await ctx.models.monitors.inTeam(ctx.team.id).find(monitor_id);
		if (!monitor) return notFound("Not Found");

		let existingCount = await ctx.models.contentChecks.ofMonitor(monitor_id).count();
		if (existingCount >= MAX_CONTENT_CHECKS_PER_MONITOR) {
			return unprocessableEntity("A monitor supports at most 10 content checks.");
		}

		unwrap(
			await ctx.models.contentChecks.create({
				monitor_id,
				type,
				value,
				case_sensitive,
				is_enabled: true,
			}),
		);

		session?.flash("toast", { intent: "success", message: "Content check added." });
		return redirect(
			routes.app.team.monitors.edit.href({ team: ctx.team.slug, monitorId: monitor_id }),
			{
				status: redirect.Status.SeeOther,
			},
		);
	},
);

/** DELETE /actions/:team/delete-content-check */
export const deleteContentCheck = createAction(
	routes.actions.monitor.http.deleteContentCheck,
	async (ctx) => {
		let result = await validate(ctx.formData, DeleteContentCheckSchema);

		if (isFailure(result)) {
			return redirect(routes.app.team.dashboard.index.href({ team: ctx.team.slug }), {
				status: redirect.Status.SeeOther,
			});
		}

		let { monitor_id, content_check_id } = result.data;

		let monitor = await ctx.models.monitors.inTeam(ctx.team.id).find(monitor_id);
		if (!monitor) return notFound("Not Found");

		let check = await ctx.models.contentChecks.ofMonitor(monitor_id).find(content_check_id);
		if (!check) return notFound("Not Found");

		unwrap(await ctx.models.contentChecks.delete(check.id));

		ctx.get(Session)?.flash("toast", { intent: "success", message: "Content check removed." });
		return redirect(
			routes.app.team.monitors.edit.href({ team: ctx.team.slug, monitorId: monitor_id }),
			{
				status: redirect.Status.SeeOther,
			},
		);
	},
);
