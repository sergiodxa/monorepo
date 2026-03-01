import { Logger } from "@pkg/logger/request";
import { DurableObject } from "cloudflare:workers";
import { createDatabase } from "remix/data-table";

import { createSQLStorageDatabaseAdapter } from "~/lib/sql-storage-adapter";

import createRouter from "./router";

export default class Tenant extends DurableObject {
	private readonly db = createDatabase(createSQLStorageDatabaseAdapter(this.ctx.storage.sql));

	constructor(state: DurableObjectState, env: Cloudflare.Env) {
		super(state, env);

		// state.blockConcurrencyWhile(() => this.migrate());
	}

	override async fetch(request: Request): Promise<Response> {
		let logger = new Logger(request);
		try {
			let response = await createRouter(this.db, logger).fetch(request);
			logger.response = response;
			return response;
		} finally {
			logger.flush();
		}
	}

	private async migrate() {
		let migrations = await Promise.all([
			import("./migrations/0001-init.sql?raw").then(({ default: migration }) => migration),
			import("./migrations/0002-add-users.sql?raw").then(({ default: migration }) => migration),
		]);

		for (let migration of migrations) this.ctx.storage.sql.exec(migration);
	}
}
