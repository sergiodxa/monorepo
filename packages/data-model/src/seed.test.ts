/**
 * Acceptance tests for `defineSeed`: steps run in order against the database a run binds,
 * write fixed rows through the models or generated ones through factories, reproduce the same
 * values from the same seed, and stop at the step that throws.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { describe, expect, test } from "vite-plus/test";

import { createIds, users } from "./fixtures/schema.js";
import { openDatabase } from "./fixtures/sqlite.js";
import { defineSeed } from "./seed.js";
import { defineFactory } from "./testing.js";

import { createModel, createModels } from "./index.js";

/** A registry of users, ids drawn in order, and a factory naming each user from the sample. */
function setup() {
	let ids = createIds();
	let Users = createModel(users, {
		optional: ["id"],
		callbacks: {
			async beforeCreate(values) {
				return { ...values, id: values.id ?? ids() };
			},
		},
	});
	let UserFactory = defineFactory(Users, {
		name: ({ sample }) => sample.person.fullName(),
		email: ({ sequence }) => `user${sequence}@example.com`,
		role: "member",
	});
	return { registry: createModels({ users: Users }), UserFactory };
}

describe("defineSeed", () => {
	test("runs each step in order, with fixed rows and factory rows", async () => {
		let { registry, UserFactory } = setup();
		let seeder = defineSeed(registry, {
			admin: ({ models }) =>
				models.users.create({ email: "admin@example.com", name: "Admin", role: "admin" }),
			members: ({ factories }) => factories.createMany(UserFactory, 2),
		});
		let { db, sqlite } = openDatabase();

		let ran = unwrap(await seeder.run({ db }));

		expect(ran).toEqual(["admin", "members"]);
		expect(sqlite.prepare("select email, role from users order by email").all()).toEqual([
			{ email: "admin@example.com", role: "admin" },
			{ email: "user1@example.com", role: "member" },
			{ email: "user2@example.com", role: "member" },
		]);
	});

	test("writes the same values on every run with the same seed", async () => {
		let { registry, UserFactory } = setup();
		let seeder = defineSeed(registry, {
			members: ({ factories }) => factories.createMany(UserFactory, 3),
		});
		let names = async (seed: number) => {
			let { db, sqlite } = openDatabase();
			unwrap(await seeder.run({ db }, { seed }));
			return sqlite.prepare("select name from users order by email").all();
		};

		let [first, again, other] = [await names(1), await names(1), await names(2)];

		expect(again).toEqual(first);
		expect(other).not.toEqual(first);
	});

	test("stops at the step that throws and names it", async () => {
		let { registry } = setup();
		let reached: string[] = [];
		let seeder = defineSeed(registry, {
			broken: async () => {
				throw new Error("no such table");
			},
			after: async () => reached.push("after"),
		});
		let { db } = openDatabase();

		let result = await seeder.run({ db });

		expect(isFailure(result) && result.error.message).toBe("The broken seed step failed");
		expect(reached).toEqual([]);
	});
});
