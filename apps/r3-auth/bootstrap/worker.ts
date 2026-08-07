/**
 * Cloudflare Worker entry point for the authorization server. Its `fetch` handler
 * opens a service-container scope, builds the application router, and forwards the
 * request to it, so everything a request touches resolves its dependencies from the
 * same scope. The `scheduled` and `queue` handlers arrive with the background job.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import { container } from "~/app/lib/container";

import application from "./app";

export default {
	/**
	 * Serves an HTTP request inside a container scope.
	 * @param request - The inbound request.
	 * @returns The router's response.
	 */
	async fetch(request: Request) {
		return await container.scope(async () => {
			let app = application({ database: getServiceContainer().get(Database) });
			return await app.fetch(request);
		});
	},
} satisfies ExportedHandler<Cloudflare.Env>;
