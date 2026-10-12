/**
 * Tests for the job `database()`, driven through a real `@sdxc/jobs` dispatcher over an
 * in-memory SQLite database, so what a job handler reads off `ctx.db` and the `Database` key is
 * the instance the middleware was given.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DatabaseSync } from "node:sqlite";

import type { JobDispatcherContext } from "@sdxc/jobs";
import type { Database as DataTable } from "remix/data-table";

import { createJobDispatcher, createJobHandler, job, jobs } from "@sdxc/jobs";
import { createSqliteDatabase } from "remix/data-table/sqlite";
import { describe, expect, expectTypeOf, test } from "vitest";

import { Database, database } from "./jobs.js";

/** The one job the dispatcher under test runs. */
const JOBS = jobs({ sweep: job({ cron: "0 0 * * *" }) });

describe(database, () => {
	test("publishes the instance under the Database key on every run", async () => {
		let db: DataTable = createSqliteDatabase(new DatabaseSync(":memory:"));
		let seen: DataTable[] = [];

		let dispatcher = createJobDispatcher({ middleware: [database(db)] as const });
		dispatcher.map(JOBS.sweep, async () => ({
			default: createJobHandler(JOBS.sweep, (ctx) => void seen.push(ctx.require(Database))),
		}));

		await dispatcher.deliver({ id: "m1", attempts: 1, body: { type: "sweep" } });
		await dispatcher.deliver({ id: "m2", attempts: 1, body: { type: "sweep" } });

		expect(seen).toEqual([db, db]);
	});

	test("calls a source once per run, so each run reads the database it returns", async () => {
		let first = createSqliteDatabase(new DatabaseSync(":memory:"));
		let second = createSqliteDatabase(new DatabaseSync(":memory:"));
		let current = first;
		let seen: DataTable[] = [];

		let dispatcher = createJobDispatcher({ middleware: [database(() => current)] as const });
		dispatcher.map(JOBS.sweep, async () => ({
			default: createJobHandler(JOBS.sweep, (ctx) => void seen.push(ctx.require(Database))),
		}));

		await dispatcher.deliver({ id: "m1", attempts: 1, body: { type: "sweep" } });
		current = second;
		await dispatcher.deliver({ id: "m2", attempts: 1, body: { type: "sweep" } });

		expect(seen).toEqual([first, second]);
	});

	test("types ctx.db on the context a dispatcher derives from its middleware", () => {
		let db: DataTable = createSqliteDatabase(new DatabaseSync(":memory:"));
		let dispatcher = createJobDispatcher({ middleware: [database(db)] as const });

		expectTypeOf<JobDispatcherContext<typeof dispatcher>["db"]>().toEqualTypeOf<DataTable>();
	});
});
