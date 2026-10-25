/**
 * One maintenance window of a public status page as a JSCalendar download, the same event
 * and `uid` the `.ics` download and the feeds carry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@sdxc/http/response/html";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import {
	calendarRepresentation,
	loadMaintenanceCalendar,
} from "~/app/services/status-page-maintenance";
import routes from "~/routes/web";

/**
 * GET /status/:slug/maintenance/:windowId.json — 404s for whatever the `.ics` download
 * 404s for.
 */
export default createAction(routes.statusPageMaintenanceEventJson, async (ctx) => {
	let { slug, windowId } = s.parse(
		s.object({ slug: s.string(), windowId: s.string() }),
		ctx.params,
	);

	let published = await loadMaintenanceCalendar(ctx, slug, windowId);
	if (!published) return notFound("Not Found");

	return calendarRepresentation(published, "jscalendar", { download: "maintenance" });
});
