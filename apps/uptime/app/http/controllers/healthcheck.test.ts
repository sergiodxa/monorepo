/**
 * Tests the `/healthcheck` controller: a real in-memory SQLite database (with
 * migrations applied) proves the happy path returns `{ status: "ok" }`, and a
 * `Database` whose `count` throws proves the failure path returns 503
 * `{ status: "error" }` without leaking the underlying error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { createRouter } from "remix/router";

import healthcheck from "~/app/http/controllers/healthcheck";
import { createTestDatabase } from "~/app/lib/test/db";
import routes from "~/routes/web";

type Db = ReturnType<typeof createTestDatabase>["db"];

/** Wraps a real database so `count` always throws, simulating a D1 outage. */
function withFailingCount(db: Db): Db {
	return new Proxy(db, {
		get(target, prop, receiver) {
			if (prop === "count") {
				return async () => {
					throw new Error("boom");
				};
			}
			return Reflect.get(target, prop, receiver);
		},
	});
}

async function dispatch(db: Db) {
	let router = createRouter();
	router.map(routes.healthcheck, healthcheck);

	let container = new ServiceContainer();
	container.singleton(Database, () => db);

	let request = new Request(`https://example.com${routes.healthcheck.href()}`);
	return container.scope(() => router.fetch(request));
}

describe("GET /healthcheck", () => {
	test('returns 200 { status: "ok" } when D1 is reachable', async () => {
		let { db } = createTestDatabase();

		let response = await dispatch(db);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ status: "ok" });
	});

	test('returns 503 { status: "error" } when the D1 query fails', async () => {
		let { db } = createTestDatabase();

		let response = await dispatch(withFailingCount(db));

		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({ status: "error" });
	});
});
