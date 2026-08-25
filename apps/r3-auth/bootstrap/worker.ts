/**
 * Cloudflare Worker entry point for the authorization server. Its `fetch` handler
 * opens a service-container scope, builds the application router, and forwards the
 * request to it, so everything a request touches resolves its dependencies from the
 * same scope. `scheduled` enqueues the daily session sweep and `queue` runs it, each
 * inside a scope of its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { logger } from "@pkg/logger";
import { env, waitUntil } from "cloudflare:workers";
import * as s from "remix/data-schema";

import { QueueMessageSchema } from "~/app/http/validators/queue";
import { container } from "~/app/lib/container";

import application from "./app";

/**
 * Domain the session cookie is scoped to in production, so one sign-in at this server
 * is visible to every app under it. A `Domain` naming a different host makes the cookie
 * be dropped silently, so it stays unset outside production.
 */
const PRODUCTION_COOKIE_DOMAIN = ".sergiodxa.com";

/**
 * Cron expression that enqueues the daily session sweep. Compared against
 * each delivery, so adding a second trigger later cannot make this one
 * enqueue twice — the production schedule and queue slot move here later.
 */
const DAILY_CRON = "0 0 * * *";

/**
 * Whether the request arrived on the production host, the only place the
 * session cookie may carry `Secure` and a domain. Decided per request since
 * the same build also serves `localhost` and a `workers.dev` verification host.
 */
function isProductionHost(request: Request): boolean {
	let hostname = new URL(request.url).hostname;
	return hostname === "auth.sergiodxa.com";
}

export default {
	/**
	 * Serves an HTTP request inside a container scope.
	 * @param request - The inbound request.
	 * @returns The router's response.
	 */
	async fetch(request: Request) {
		return await container.scope(async () => {
			let production = isProductionHost(request);

			let app = application({
				kv: env.KV,
				cookieSecret: env.COOKIE_SESSION_SECRET,
				secure: production,
				cookieDomain: production ? PRODUCTION_COOKIE_DOMAIN : undefined,
			});

			return await app.fetch(request);
		});
	},

	/**
	 * Enqueues the work a cron delivery implies, so a sweep that outgrows the
	 * trigger's budget becomes the queue's problem and gets its own retries.
	 * @param controller - The trigger being delivered.
	 */
	async scheduled(controller) {
		if (controller.cron === DAILY_CRON) {
			waitUntil(env.QUEUE.send({ type: "cleanExpiredSessions" }));
		}
	},

	/**
	 * Runs the job each queued message names, inside one container scope for the batch.
	 * Acks a body matching no known type, since a redelivery reaches the same result.
	 * Logs only the type of an unrecognized body, since its content is untrusted.
	 * @param batch - The messages this delivery carries.
	 */
	async queue(batch) {
		await container.scope(async () => {
			let uptime = env.UPTIME_CRON_API_KEY;

			for (let message of batch.messages) {
				let result = s.parseSafe(QueueMessageSchema, message.body);

				if (!result.success) {
					logger.error("queue.invalid_message", { id: message.id });
					message.ack();
					continue;
				}

				switch (result.value.type) {
					case "cleanExpiredSessions": {
						/**
						 * Imported lazily, so parsing this job's module is a cost
						 * only a queue delivery pays.
						 */
						let { CleanExpiredSessionsJob } = await import("~/app/jobs/clean-expired-sessions");
						waitUntil(CleanExpiredSessionsJob.run({ message, uptime }));
						break;
					}
				}
			}
		});
	},
} satisfies ExportedHandler<Cloudflare.Env>;
