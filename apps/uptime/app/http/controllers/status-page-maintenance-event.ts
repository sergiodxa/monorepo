/**
 * One maintenance window of a public status page as an `.ics` download, for a reader who
 * wants that window in their calendar without subscribing. It carries the feed's `UID`s,
 * so a calendar holding both shows the window once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vary } from "@sdxc/http/cache";
import { notFound } from "@sdxc/http/response/html";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import {
	calendarRepresentation,
	loadMaintenanceCalendar,
	negotiateCalendarFormat,
} from "~/app/services/status-page-maintenance";
import routes from "~/routes/web";

/**
 * GET /status/:slug/maintenance/:windowId.ics — 404s for a private page, and for a window
 * the page does not publish: another team's, one hidden from status pages, or one scoped
 * to services the page does not show. An `Accept` preferring JSCalendar gets that format.
 */
export default createAction(routes.statusPageMaintenanceEvent, async (ctx) => {
	let { slug, windowId } = s.parse(
		s.object({ slug: s.string(), windowId: s.string() }),
		ctx.params,
	);

	let published = await loadMaintenanceCalendar(ctx, slug, windowId);
	if (!published) return notFound("Not Found");

	let headers = new Headers();
	vary(headers, ["Accept"]);

	return calendarRepresentation(published, negotiateCalendarFormat(ctx.request), {
		headers,
		download: "maintenance",
	});
});
