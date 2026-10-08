/**
 * `POST /webhooks/sponsors` — GitHub's sponsorship webhook, behind the signature check.
 * Every `sponsorship` event queues a roster refresh, so a new or ended sponsorship shows on
 * `/sponsors` within moments of GitHub reporting it rather than at the next scheduled run.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import jobs from "~/app/jobs";
import routes from "~/routes/web";

/** The event GitHub sends for every change to a sponsorship. */
const SPONSORSHIP_EVENT = "sponsorship";

/**
 * Answers `202` once the refresh is queued, and `204` to any other event, such as the
 * `ping` GitHub sends when the hook is created. GitHub is read on the queue, so the
 * delivery is answered well inside GitHub's ten-second timeout.
 */
export default createAction(routes.sponsorsWebhook, async (ctx) => {
	if (ctx.request.headers.get("x-github-event") !== SPONSORSHIP_EVENT) {
		return new Response(null, { status: 204 });
	}

	await ctx.jobs.enqueue(jobs.sponsors.refresh);
	return new Response(null, { status: 202 });
});
