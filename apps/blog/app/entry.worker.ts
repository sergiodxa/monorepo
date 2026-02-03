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
