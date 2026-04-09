import { createDatabase } from "remix/data-table";

import { createD1DataTableAdapter } from "~/app/infrastructure/database/d1-data-table-adapter";

import createApplication from "./app";

/**
 * Handles incoming Worker requests by creating the app router with
 * environment-backed dependencies and forwarding the request to it.
 */
export default {
	async fetch(request: Request, env: Cloudflare.Env) {
		let database = createDatabase(createD1DataTableAdapter(env.DB));
		let IS_PROD = resolveIsProd(request);

		let [CLIENT_ID, CLIENT_SECRET, COOKIE_SESSION_SECRET] = await Promise.all([
			env.CLIENT_ID.get(),
			env.CLIENT_SECRET.get(),
			env.COOKIE_SESSION_SECRET.get(),
		]);

		let router = createApplication(database, {
			IS_PROD,
			CLIENT_ID,
			CLIENT_SECRET,
			COOKIE_SESSION_SECRET,
			AUTH: env.AUTH,
			REDIRECTS: env.REDIRECTS,
		});

		return await router.fetch(request);
	},
} satisfies ExportedHandler<Cloudflare.Env>;

function resolveIsProd(request: Request) {
	let hostname = new URL(request.url).hostname;
	if (hostname === "localhost") return false;
	if (hostname === "127.0.0.1") return false;
	if (hostname.endsWith(".workers.dev")) return false;
	return true;
}
