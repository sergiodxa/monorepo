import { createDatabase } from "remix/data-table";

import { createD1DataTableAdapter } from "~/app/infrastructure/database/d1-data-table-adapter";

import createApplication from "./app";

export default {
	async fetch(request: Request, env: Cloudflare.Env) {
		let database = createDatabase(createD1DataTableAdapter(env.DB));
		let isProd = resolveIsProd(request);

		let router = createApplication(database, {
			IS_PROD: isProd,
			CLIENT_ID: env.CLIENT_ID,
			CLIENT_SECRET: env.CLIENT_SECRET,
			COOKIE_SESSION_SECRET: env.COOKIE_SESSION_SECRET ?? "s3cr3t",
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
