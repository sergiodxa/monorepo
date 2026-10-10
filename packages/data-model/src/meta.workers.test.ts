/**
 * Holds the meta write's ordering to its contract on a real D1 binding, where the insert and
 * the prune commit separately: a failed prune leaves reads on the new value, and the next write
 * of that key removes the leftovers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { unwrap } from "@sdxc/result";
import { env, reset } from "cloudflare:test";
import { Database } from "remix/data-table";
import { expect, test } from "vitest";

import { intercept } from "./fixtures/intercept.js";
import {
	createClock,
	createIds,
	postMeta,
	posts,
	SCHEMA_STATEMENTS,
	users,
} from "./fixtures/schema.js";

import { createModel, field } from "./index.js";

test("a failed prune on D1 leaves reads on the latest value until the next write cleans up", async () => {
	await reset();
	for (let statement of SCHEMA_STATEMENTS) await env.DB.prepare(statement).run();
	let { driver, failWhen, heal } = intercept(createD1DatabaseAdapter(env.DB));
	let db = new Database(driver, { now: createClock() });
	let Articles = createModel(posts, {
		constraints: { type: "article" },
		optional: ["id"],
		metaTable: { table: postMeta, foreignKey: "post_id", generateId: createIds("meta") },
		meta: { title: field.text() },
		callbacks: {
			async beforeCreate(values) {
				return { ...values, id: values.id ?? "p1" };
			},
		},
	});
	let articles = Articles.bind({ db });
	await db.create(users, { id: "author", email: "a@example.com", name: "A", role: "member" });
	unwrap(
		await articles.create({ author_id: "author", published_at: null, meta: { title: "One" } }),
	);

	failWhen((kind, table) => kind === "delete" && table === "post_meta");
	await expect(articles.update("p1", { meta: { title: "Two" } })).rejects.toThrow();
	heal();

	expect((await articles.find("p1"))?.meta.title).toBe("Two");
	expect(await db.count(postMeta, { where: { key: "title" } })).toBe(2);

	unwrap(await articles.update("p1", { meta: { title: "Three" } }));

	expect((await articles.find("p1"))?.meta.title).toBe("Three");
	expect(await db.count(postMeta, { where: { key: "title" } })).toBe(1);
});
