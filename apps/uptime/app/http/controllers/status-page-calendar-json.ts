/**
 * The JSCalendar (RFC 8984) feed of a public status page's maintenance: the same windows,
 * events and `uid`s as the iCalendar feed, as one `Group`, for clients that read JSON.
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
} from "~/app/services/status-page-maintenance";
import routes from "~/routes/web";

/**
 * GET /status/:slug/maintenance.json — 404s for a private or unknown page, and is cached
 * like the iCalendar feed it mirrors.
 */
export default createAction(routes.statusPageCalendarJson, async (ctx) => {
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
	vary(headers, ["Accept-Language", "Cookie"]);

	return calendarRepresentation(published, "jscalendar", { headers });
});
