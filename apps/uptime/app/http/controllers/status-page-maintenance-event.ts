/**
 * One maintenance window of a public status page as an `.ics` download, for a reader who
 * wants that window in their calendar without subscribing. It carries the feed's `UID`s,
 * so a calendar holding both shows the window once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import { calendarResponse } from "@sdxc/icalendar";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import StatusPage from "~/app/data/status-page";
import { apportionCostByTeam } from "~/app/services/cost";
import {
	listPageServices,
	listPublishedMaintenance,
	maintenanceCalendar,
} from "~/app/services/status-page-maintenance";
import routes from "~/routes/web";

/**
 * GET /status/:slug/maintenance/:windowId.ics — 404s for a private page, and for a window
 * the page does not publish: another team's, one hidden from status pages, or one scoped
 * to services the page does not show.
 */
export default createAction(routes.statusPageMaintenanceEvent, async (ctx) => {
	let { slug, windowId } = s.parse(
		s.object({ slug: s.string(), windowId: s.string() }),
		ctx.params,
	);

	let page = await StatusPage.findBySlugPublic(ctx.db, slug);
	if (!page) return notFound("Not Found");

	apportionCostByTeam([page.team_id]);

	let services = await listPageServices(ctx.db, page);
	let entries = await listPublishedMaintenance(ctx.db, page, services, Date.now());
	let entry = entries.find((candidate) => candidate.window.id === windowId);
	if (!entry) return notFound("Not Found");

	let url = new URL(routes.statusPage.href({ slug }), ctx.url).toString();
	let calendar = maintenanceCalendar(
		[entry],
		{
			name: ctx.intl.t("statusPage.maintenance.calendarName", { title: page.title }),
			describe: (affected) =>
				affected.length > 0
					? ctx.intl.t("statusPage.maintenance.affects", { services: affected.join(", ") })
					: undefined,
		},
		url,
	);

	return calendarResponse(calendar, { filename: "maintenance.ics" });
});
