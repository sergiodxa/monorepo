/**
 * `POST /webhooks/sponsors` — GitHub's sponsorship webhook. Every signed `sponsorship`
 * event re-reads the roster, so a new or ended sponsorship shows on the site within
 * seconds of GitHub reporting it rather than at the next scheduled refresh.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { env } from "cloudflare:workers";
import { createAction } from "remix/router";

import { siteCache } from "~/app/services/cache";
import { verifyGitHubDelivery } from "~/app/services/github-webhook";
import { refreshSponsors } from "~/app/services/sponsors";
import routes from "~/routes/web";

/** The event GitHub sends for every change to a sponsorship. */
const SPONSORSHIP_EVENT = "sponsorship";

/**
 * Answers `401` to an unsigned or mis-signed delivery and `204` to any other event, such as
 * the `ping` GitHub sends when the hook is created. A refresh GitHub cannot serve answers
 * `502`, which GitHub records as a failed delivery that can be redelivered.
 */
export default createAction(routes.sponsorsWebhook, async (ctx) => {
	let event = await verifyGitHubDelivery(ctx.request, env.GITHUB_SPONSORS_WEBHOOK_SECRET);
	if (isFailure(event)) {
		ctx.log.set({ sponsors: { rejected: event.error.message } });
		return new Response(null, { status: 401 });
	}

	if (event.data !== SPONSORSHIP_EVENT) return new Response(null, { status: 204 });

	let token = env.GITHUB_TOKEN;
	if (!token) {
		ctx.log.set({ sponsors: { skipped: "missing_token" } });
		return new Response(null, { status: 503 });
	}

	let roster = await refreshSponsors(siteCache(), token).catch((error: unknown) =>
		error instanceof Error ? error : new Error(String(error)),
	);
	if (roster instanceof Error) {
		ctx.log.fail(roster);
		return new Response(null, { status: 502 });
	}

	ctx.log.set({ sponsors: { current: roster.current.length, past: roster.past.length } });
	return new Response(null, { status: 204 });
});
