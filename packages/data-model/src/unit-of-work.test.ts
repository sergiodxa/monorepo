/**
 * Runs the unit-of-work contract on SQLite with real transactions, on SQLite bound as though it
 * had none, and on the Durable Object SQLite adapter, which refuses `db.transaction()`, so the
 * degraded contract is pinned without a Cloudflare runtime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createSqlStorage } from "@sdxc/cloudflare-mocks";
import { createSQLStorageDatabaseAdapter } from "@sdxc/data-table-sqlstorage";
import { Database } from "remix/data-table";

import { createClock, SCHEMA_STATEMENTS } from "./fixtures/schema.js";
import { openDatabase } from "./fixtures/sqlite.js";
import { describeUnitOfWork } from "./fixtures/unit-of-work-contract.js";

describeUnitOfWork("SQLite with real transactions", {
	open: async () => openDatabase().db,
	transactions: "database",
	atomic: true,
});

describeUnitOfWork("SQLite bound without transactions", {
	open: async () => openDatabase().db,
	transactions: "none",
	atomic: false,
});

describeUnitOfWork("Durable Object SQLite, which refuses transactions", {
	open: async () => {
		let storage = createSqlStorage();
		for (let statement of SCHEMA_STATEMENTS) storage.exec(statement);
		return new Database(createSQLStorageDatabaseAdapter(storage), { now: createClock() });
	},
	transactions: "none",
	atomic: false,
});
