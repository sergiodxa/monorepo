/**
 * Cloudflare Worker fetch entry point that lazily builds the React Router request
 * handler, creates a per-request router context seeded with a request Logger, and
 * dispatches each incoming request while capturing, logging, and flushing errors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestHandler } from "react-router";

import { Logger } from "@pkg/logger/request";
import { RouterContextProvider, createRequestHandler } from "react-router";

let handler: RequestHandler | null = null;

export default {
	async fetch(request: Request) {
		// Dynamically import React Router server build
		// This helps reduce worker init time
		let build = await import("virtual:react-router/server-build");
		// Only create a request handler if `handler` is still null (first request)
		if (handler === null) handler = createRequestHandler(build);

		// Create a new router context for each request
		let context = new RouterContextProvider();

		// Create a request logger and set it in the context
		let logger = new Logger(request);
		context.set(Logger.context, logger);

		try {
			// Call the handler with the request and context
			let response = await handler(request, context);
			// Set the response metadata in the logger
			logger.response = response;
			return response;
		} catch (error) {
			// Log unhandled errors
			logger.error("request.unhandled_error", {
				error: error instanceof Error ? error.message : String(error),
			});
			throw error;
		} finally {
			// Flush logs to console
			logger.flush();
		}
	},
} satisfies ExportedHandler<Cloudflare.Env>;
