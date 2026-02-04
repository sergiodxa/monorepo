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

	async scheduled(controller, env, ctx) {
		if (controller.cron === "0 0 * * *") {
			let db = await import("../db").then((m) => m.default(env.DB));
			let Session = await import("./models/session").then((m) => m.default);
			ctx.waitUntil(Session.deleteExpiredSessions(db));
		}
	},
} satisfies ExportedHandler<Cloudflare.Env>;
