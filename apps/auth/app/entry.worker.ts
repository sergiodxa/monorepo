/**
 * Cloudflare Worker entry point for the auth app. Exposes the fetch handler
 * that lazily builds and serves the React Router request handler, a scheduled
 * cron trigger that enqueues session cleanup, and a queue consumer that
 * validates messages and dispatches the clean-expired-sessions job.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { logger } from "@pkg/logger";
import { env, waitUntil } from "cloudflare:workers";
import { type RequestHandler, RouterContextProvider } from "react-router";

let handler: RequestHandler;

export default {
	async fetch(request: Request) {
		let build = await import("virtual:react-router/server-build");

		if (!handler) {
			let { createRequestHandler } = await import("react-router");
			handler = createRequestHandler(build, import.meta.env.MODE);
		}

		let context = new RouterContextProvider();
		return await handler(request, context);
	},

	async scheduled(controller) {
		if (controller.cron === "0 0 * * *") {
			waitUntil(env.QUEUE.send({ type: "cleanExpiredSessions" }));
		}
	},

	async queue(batch) {
		let { z } = await import("zod");
		let uptime = env.UPTIME_CRON_API_KEY;

		for (let message of batch.messages) {
			let result = z
				.discriminatedUnion("type", [z.object({ type: z.literal("cleanExpiredSessions") })])
				.transform((data) => data.type)
				.safeParse(message.body);

			if (result.success === false) {
				logger.error("queue.invalid_message", { error: result.error, message: message.body });
				message.ack();
				continue;
			}

			if (result.data === "cleanExpiredSessions") {
				let { CleanExpiredSessionsJob } = await import("./jobs/clean-expired-sessions");
				waitUntil(CleanExpiredSessionsJob.run({ message, uptime }));
			}
		}
	},
} satisfies ExportedHandler<Cloudflare.Env>;
