import { createDatabase } from "remix/data-table";

import { createD1DataTableAdapter } from "~/infrastructure/database/d1-data-table-adapter";

import application from "./app";

/**
 * Handles incoming Worker requests by creating the app router with
 * environment-backed dependencies and forwarding the request to it.
 */
export default {
	async fetch(request: Request, env: Cloudflare.Env) {
		let database = createDatabase(createD1DataTableAdapter(env.DB));
		let app = application({ database });
		return await app.fetch(request);
	},
} satisfies ExportedHandler<Cloudflare.Env>;
