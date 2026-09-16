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

import { hmac } from "@sdxc/crypto";
import { KVAdapter } from "@sdxc/rate-limit";
import { rateLimit } from "@sdxc/rate-limit/middleware";
import { isFailure } from "@sdxc/result";
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

/** The only signature algorithm this app asks for, and so the only one it accepts. */
const SIGNATURE_PREFIX = "sha256=";

/**
 * Answered to a hub whose delivery was refused, and to one whose delivery was accepted.
 *
 * The response is a prober's only feedback, so one that told "wrong signature" apart from
 * "accepted" would be an oracle for guessing at the secret. What went wrong is recorded in
 * an event instead.
 */
const ACKNOWLEDGED = 202;

/**
 * Answered to anything that did not come from a hub this app subscribed through, which is
 * what a subscriber is asked to answer for a subscription it never requested.
 */
const UNKNOWN = 404;

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
		 * GET /websub/:feedId/:token — the hub's verification.
		 *
		 * The challenge comes back only when the token, the topic and a subscription this
		 * object is waiting on all agree. That is the whole defence against being enrolled in
		 * somebody else's topic: a hub told to deliver a feed this app never asked for is
		 * answered with nothing it can act on.
		 */
		async index(ctx) {
			let { feedId, token } = s.parse(Params, ctx.params);
			let query = ctx.url.searchParams;

			let challenge = await feedStore(feedId).verifyHub({
				token,
				mode: query.get("hub.mode") ?? "",
				topic: query.get("hub.topic") ?? "",
				challenge: query.get("hub.challenge") ?? "",
				leaseSeconds: Number(query.get("hub.lease_seconds") ?? 0),
			});

			if (challenge === null) return new Response(null, { status: UNKNOWN });

			return new Response(challenge, {
				status: 200,
				headers: { "content-type": "text/plain; charset=utf-8" },
			});
		},

		/**
		 * POST /websub/:feedId/:token — one notification.
		 *
		 * The signature is checked over the bytes exactly as they arrived, before anything
		 * reads them, since a signature recomputed over a re-serialized body is a signature
		 * over a different document. What a delivery that verifies buys is a retrieval from
		 * the publisher's own origin: the body itself is never parsed and never stored, so a
		 * hub that has been compromised cannot put a post in anybody's timeline.
		 */
		async action(ctx) {
			let { feedId, token } = s.parse(Params, ctx.params);

			let credentials = await feedStore(feedId).hubSecretFor(token);
			if (credentials === null) {
				ctx.log.warn("feed.hub.rejected", { feedId, reason: "token" });
				return new Response(null, { status: UNKNOWN });
			}

			let body = new Uint8Array(await ctx.request.arrayBuffer());
			let signature = ctx.request.headers.get("x-hub-signature") ?? "";

			if (!(await signed(credentials.secret, body, signature))) {
				ctx.log.warn("feed.hub.rejected", { feedUrl: credentials.feedUrl, reason: "signature" });
				return new Response(null, { status: ACKNOWLEDGED });
			}

			let notice = await feedStore(feedId).notified();

			ctx.log.note("feed.hub.notified", {
				feedUrl: notice.feedUrl,
				bytes: body.byteLength,
				coalesced: notice.coalesced,
				inserted: notice.inserted,
			});

			return new Response(null, { status: ACKNOWLEDGED });
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

/**
 * Whether a delivery carries the signature the subscription's secret produces over exactly
 * these bytes.
 *
 * Every subscription supplies a secret, so a delivery with no signature is always a
 * refusal — which removes the branch where an attacker picks the weaker path by leaving
 * the header off.
 *
 * @param secret - The secret the subscription was made with.
 * @param body - The delivery's bytes as they arrived.
 * @param header - The `X-Hub-Signature` the delivery carried, if it carried one.
 */
async function signed(secret: string, body: Uint8Array, header: string): Promise<boolean> {
	if (!header.startsWith(SIGNATURE_PREFIX)) return false;

	let verified = await hmac.verify(secret, body, header.slice(SIGNATURE_PREFIX.length));

	return !isFailure(verified) && verified.data;
}
