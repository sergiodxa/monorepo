/**
 * Cloudflare Worker fetch entry point for the blog app. Lazily imports the
 * React Router server build, memoizes a request handler, and on each request
 * builds a router context seeded with the Worker's env, execution context, and
 * Cloudflare request properties. This is the outermost runtime boundary that
 * hands incoming HTTP requests to the framework.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ExecutionContext } from "@cloudflare/workers-types";
import type { RequestHandler } from "react-router";

import { RouterContextProvider, createRequestHandler } from "react-router";

import { CloudflareContext } from "./middleware/bindings";

let handler: RequestHandler | null = null;

export default {
	async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
		let build = await import("virtual:react-router/server-build");
		if (handler === null) handler = createRequestHandler(build);

		let context = new RouterContextProvider();
		context.set(CloudflareContext, { env, ctx, cf: request.cf });

		return await handler(request, context);
	},
};
