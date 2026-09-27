/**
 * `/websub/:feedId/:token` — where a publisher's hub verifies a subscription and then
 * delivers. The `GET` echoes a challenge only for a subscription this app is waiting on,
 * and the `POST` proves a delivery came from the hub this app shares a secret with before
 * it lets that delivery decide anything.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { KVAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { isFailure } from "@sdxc/result";
import {
	acknowledge,
	gone,
	parseVerification,
	received,
	refuse,
	verifyDelivery,
} from "@sdxc/websub/subscriber";
import { env } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { createController } from "remix/router";

import { feedStore } from "~/database/feed-do";
import routes from "~/routes/web";

/** The path this route matches: the feed to reach, and the secret half of the address. */
const Params = s.object({ feedId: s.string(), token: s.string() });

/**
 * Notifications one feed's callback answers in a minute.
 *
 * The object already refuses to fetch a publisher more than once a minute, which bounds
 * what a flood costs the publisher; this bounds what it costs this app, since every
 * delivery past it is refused without waking anything.
 */
const NOTIFICATIONS_PER_MINUTE = 60;

/**
 * Refuses a feed's callback past its budget without reaching the object.
 *
 * Keyed by feed id rather than by connecting address: a hub is one caller delivering for
 * many publishers, and one busy feed of theirs must not spend the budget of the rest.
 */
const limit: Middleware = rateLimit({
	adapter: new KVAdapter(env.KV, {
		limit: NOTIFICATIONS_PER_MINUTE,
		window: "1 minute",
		prefix: "websub",
	}),
	prefix: "websub",
	key: (ctx) => limited(ctx.url),
	onLimit: (ctx) => {
		ctx.log.warn("feed.hub.rejected", { feedId: limited(ctx.url), reason: "rate" });
		return new Response(null, { status: 429 });
	},
});

export default createController(routes.websub, {
	middleware: [limit],
	actions: {
		/**
		 * GET /websub/:feedId/:token — the hub's verification. A challenge is echoed only for
		 * a subscription or unsubscription this feed asked for, so a hub told to deliver a
		 * topic this app never chose is answered with nothing it can act on.
		 */
		async index(ctx) {
			let { feedId, token } = s.parse(Params, ctx.params);

			let verification = parseVerification(ctx.url);
			if (isFailure(verification)) return refuse();

			let verdict = await feedStore(feedId).verifyHub(token, verification.data);
			if (verdict === "refused") return refuse();

			/** A denial carries no challenge, so it is answered with an empty success. */
			if (verification.data.mode === "denied") return new Response(null, { status: 204 });

			return acknowledge(verification.data);
		},

		/**
		 * POST /websub/:feedId/:token — one notification, which buys a re-fetch from the
		 * publisher's origin and nothing from its body. Refusals answer `202` like successes,
		 * so a prober learns nothing; a token no longer held answers `410` to end retries.
		 */
		async action(ctx) {
			let { feedId, token } = s.parse(Params, ctx.params);

			let credentials = await feedStore(feedId).hubSecretFor(token);
			if (credentials === null) {
				ctx.log.warn("feed.hub.rejected", { feedId, reason: "token" });
				return gone();
			}

			let delivery = await verifyDelivery(ctx.request, credentials.secret);
			if (isFailure(delivery)) {
				ctx.log.warn("feed.hub.rejected", {
					feedUrl: credentials.feedUrl,
					reason: delivery.error.reason,
				});
				return received();
			}

			let notice = await feedStore(feedId).notified();

			ctx.log.note("feed.hub.notified", {
				feedUrl: notice.feedUrl,
				bytes: delivery.data.body.byteLength,
				algorithm: delivery.data.algorithm,
				coalesced: notice.coalesced,
				inserted: notice.inserted,
			});

			return received();
		},
	},
});

/**
 * The feed one budget belongs to, read off the path rather than off the matched params:
 * the limit is spent before the route's own validation runs, so it reads what the address
 * said and lets the handler decide whether that named anything.
 *
 * @param url - The address the request arrived on.
 */
function limited(url: URL): string {
	return url.pathname.split("/")[2] ?? "unknown";
}
