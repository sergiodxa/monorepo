/**
 * Database service provider for blog. Builds a data-table Database backed by
 * the D1 binding through a D1 adapter and registers it as an application-container
 * singleton so repositories can resolve one shared connection per isolate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Container, ServiceProvider } from "@pkg/service-container";

import { createD1DatabaseAdapter } from "@pkg/data-table-d1";
import { env } from "cloudflare:workers";
import { Database } from "remix/data-table";

/** Registers the D1-backed data-table database for service-container injection. */
export class DatabaseService implements ServiceProvider {
	register(container: Container) {
		container.singleton(Database, () => {
			return new Database(createD1DatabaseAdapter(env.DB));
		});
	}
}
