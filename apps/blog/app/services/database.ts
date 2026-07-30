/**
 * Database service provider for blog. Builds a data-table Database backed by
 * the D1 binding through a D1 adapter and registers it as an application-container
 * singleton so repositories can resolve one shared connection per isolate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Container, ServiceProvider } from "@pkg/service-container";

import { env } from "cloudflare:workers";
import { Database, createDatabase } from "remix/data-table";

import { createD1DataTableAdapter } from "~/app/infrastructure/database/d1-data-table-adapter";

/** Registers the D1-backed data-table database for service-container injection. */
export class DatabaseService implements ServiceProvider {
	/** Stores the database factory in the application container. */
	register(container: Container) {
		container.singleton(Database, () => {
			let adapter = createD1DataTableAdapter(env.DB);
			return createDatabase(adapter);
		});
	}
}
