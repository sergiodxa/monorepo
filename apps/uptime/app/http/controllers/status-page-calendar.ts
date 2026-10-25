/**
 * The iCalendar feed of a public status page's maintenance, which Apple Calendar, Google
 * Calendar and Outlook subscribe to and re-fetch. It lists only windows the team chose to
 * show on status pages, and a deleted window drops out, which subscribers read as removal.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { policy, vary } from "@sdxc/http/cache";
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
 * GET /status/:slug/maintenance.ics — a private or unknown page 404s like the page itself.
 * A client whose `Accept` prefers JSCalendar gets the feed in that format. Cached as briefly
 * as the page, since the calendar name and descriptions are translated per viewer and a
 * window ended early should reach the next poll.
 */
export default createAction(routes.statusPageCalendar, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);

	let published = await loadMaintenanceCalendar(ctx, slug);
	if (!published) return notFound("Not Found");

	let headers = new Headers({
		"Cache-Control": policy({
			visibility: "public",
			maxAge: 60_000,
			staleWhileRevalidate: 300_000,
		}).toString(),
	});
	vary(headers, ["Accept", "Accept-Language", "Cookie"]);

	return calendarRepresentation(published, negotiateCalendarFormat(ctx.request), { headers });
});
