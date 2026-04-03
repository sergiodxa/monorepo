import { createDatabase } from "remix/data-table";

import { createD1DataTableAdapter } from "~/app/infrastructure/database/d1-data-table-adapter";

import createApplication from "./app";

export default {
	async fetch(request: Request, env: Cloudflare.Env) {
		let database = createDatabase(createD1DataTableAdapter(env.DB));

		let router = createApplication(database, {
			IS_PROD: import.meta.env.PROD,
			CLIENT_ID: env.CLIENT_ID,
			CLIENT_SECRET: env.CLIENT_SECRET,
			COOKIE_SESSION_SECRET: env.COOKIE_SESSION_SECRET ?? "s3cr3t",
			AUTH: env.AUTH,
			REDIRECTS: env.REDIRECTS,
		});

		return await router.fetch(request);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
