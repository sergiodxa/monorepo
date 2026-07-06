/**
 * Cloudflare Worker entry point for the r3-uptime app. Its fetch handler builds a
 * data-table database backed by the D1 binding, constructs the application router
 * with that dependency, and forwards each incoming request to it. It exists as the
 * runtime edge that connects Cloudflare's environment to the app composition root.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
