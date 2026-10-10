/**
 * Runs the unit-of-work contract inside workerd against a real D1 binding, where every
 * statement commits as it runs: events must still drop for a failed scope while the writes it
 * already made stay.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { env, reset } from "cloudflare:test";
import { Database } from "remix/data-table";

import { createClock, SCHEMA_STATEMENTS } from "./fixtures/schema.js";
import { describeUnitOfWork } from "./fixtures/unit-of-work-contract.js";

describeUnitOfWork("a real D1 binding", {
	open: async () => {
		await reset();
		for (let statement of SCHEMA_STATEMENTS) await env.DB.prepare(statement).run();
		return new Database(createD1DatabaseAdapter(env.DB), { now: createClock() });
	},
	transactions: "none",
	atomic: false,
});
