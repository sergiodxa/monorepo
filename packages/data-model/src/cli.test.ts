/**
 * Tests for the command-line `models()`, run through `@sdxc/cli/test`'s `invoke()` over an
 * in-memory SQLite database, so a command handler reads `ctx.models` bound to the database an
 * earlier middleware published, exactly as a route or job handler does.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CommandMiddleware, HandlerContext } from "@sdxc/cli";
import type { Database } from "remix/data-table";

import { argument, command, commands, createCLI, failure, success } from "@sdxc/cli";
import { invoke } from "@sdxc/cli/test";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";
import { createContextKey } from "remix/router";
import { describe, expect, expectTypeOf, test } from "vitest";

import { models, Models } from "./cli.js";
import { users } from "./fixtures/schema.js";
import { openDatabase } from "./fixtures/sqlite.js";

import type { BoundModels } from "./index.js";

import { createModel, createModels } from "./index.js";

/** The key the test's own database middleware publishes under, as an app's would. */
const DB = createContextKey<Database>();

/** Publishes `db` as `ctx.db`, standing in for the app's database middleware. */
function database(
	db: Database,
): CommandMiddleware<{ key: typeof DB; value: Database; property: "db" }> {
	return async (ctx, next) => {
		ctx.set(DB, db, { property: "db" });
		await next();
	};
}

/** A registry with a users model whose scope and method a command calls. */
function createRegistry() {
	let Users = createModel(users, {
		scopes: { active: (query) => query.where({ deleted_at: null }) },
		methods: {
			findByEmail(email: string) {
				return this.active().where({ email }).first();
			},
		},
	});
	return createModels({ users: Users });
}

/** The contract the tests run: one command creating a user, one finding one, one touching none. */
const CONTRACT = commands({
	users: commands({
		create: command({ arguments: { email: argument(s.string()) } }),
		find: command({ arguments: { email: argument(s.string()) } }),
	}),
	noop: command({}),
});

describe(models, () => {
	test("publishes ctx.models bound to the database an earlier middleware published", async () => {
		let { db } = openDatabase();
		let registry = createRegistry();
		let cli = createCLI({
			name: "app",
			commands: CONTRACT,
			middleware: [database(db), models(registry, (ctx) => ({ db: ctx.get(DB) as Database }))],
		});
		cli.map(CONTRACT.users.create, async (ctx) => {
			let created = await ctx.models.users.create({
				id: "u1",
				email: ctx.arguments.email,
				name: "Ada",
				role: "member",
			});
			return isFailure(created) ? created : success();
		});
		cli.map(CONTRACT.users.find, async (ctx) => {
			let user = await ctx.models.users.findByEmail(ctx.arguments.email);
			if (user === null) return failure(new Error(`No user ${ctx.arguments.email}`));
			ctx.stdout(`${user.id} ${user.name} ${String(ctx.get(Models) === ctx.models)}\n`);
			return success();
		});

		let created = await invoke(cli, ["users", "create", "ada@example.com"]);
		let found = await invoke(cli, ["users", "find", "ada@example.com"]);
		let missing = await invoke(cli, ["users", "find", "grace@example.com"]);

		expect(created.code).toBe(0);
		expect(found.stdout).toBe("u1 Ada true\n");
		expect(missing.code).toBe(1);
		expect(missing.stderr).toContain("No user grace@example.com");
	});

	test("builds the model context only for a run that touches a model", async () => {
		let { db } = openDatabase();
		let built = 0;
		let cli = createCLI({
			name: "app",
			commands: CONTRACT,
			middleware: [
				models(createRegistry(), () => {
					built++;
					return { db };
				}),
			],
		});
		cli.map(CONTRACT.noop, () => success());
		cli.map(CONTRACT.users.find, async (ctx) => {
			await ctx.models.users.findByEmail(ctx.arguments.email);
			return success();
		});

		await invoke(cli, ["noop"]);
		expect(built).toBe(0);

		await invoke(cli, ["users", "find", "ada@example.com"]);
		expect(built).toBe(1);
	});

	test("installs under the property the options name", async () => {
		let { db } = openDatabase();
		let cli = createCLI({
			name: "app",
			commands: CONTRACT,
			middleware: [models(createRegistry(), () => ({ db }), { property: "data" })],
		});
		cli.map(CONTRACT.noop, async (ctx) => {
			ctx.stdout(`${await ctx.data.users.query().count()}\n`);
			return success();
		});

		let run = await invoke(cli, ["noop"]);

		expect(run.stdout).toBe("0\n");
	});

	test("types ctx.models on the handler a CLI derives from its middleware", () => {
		let registry = createRegistry();
		let { db } = openDatabase();
		let cli = createCLI({
			name: "app",
			commands: CONTRACT,
			middleware: [models(registry, () => ({ db }))],
		});

		expectTypeOf<
			HandlerContext<typeof CONTRACT.noop, typeof cli.middleware, []>["models"]
		>().toEqualTypeOf<BoundModels<typeof registry.entries>>();
	});
});
