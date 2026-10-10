/**
 * Acceptance tests for the test factories: values reproducible from a seed and stable as other
 * factories change, overrides that skip an attribute's function, traits applied in order, and
 * records written through the model so its callbacks and constraints apply.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ValidationError } from "@sdxc/validate";
import { fail } from "remix/data-table";
import { createContextKey, RequestContext } from "remix/router";
import { describe, expect, test } from "vitest";

import { createIds, postMeta, posts, users } from "./fixtures/schema.js";
import { openDatabase } from "./fixtures/sqlite.js";
import { createFactories, defineFactory } from "./testing.js";

import { createModel, createModels, field } from "./index.js";

/** Collects the welcome mails a created user sends, through the host context. */
const OUTBOX = createContextKey<string[]>();

/** Builds models, their factories and a bound registry over a fresh database. */
function setup(seed: number) {
	let ids = createIds();
	let Users = createModel(users, {
		optional: ["id"],
		callbacks: {
			async validate(values) {
				if (values.name === "") return fail("Name is required", ["name"]);
			},
			async beforeCreate(values) {
				return { ...values, id: values.id ?? ids() };
			},
			async afterCommit(event, ctx) {
				if (event.operation === "create") ctx.require(OUTBOX).push(event.row.email);
			},
		},
	});
	let Articles = createModel(posts, {
		constraints: { type: "article" },
		optional: ["id"],
		metaTable: { table: postMeta, foreignKey: "post_id", generateId: createIds("meta") },
		meta: { title: field.text().required(), slug: field.text() },
		scopes: { published: (query) => query.where({ deleted_at: null }) },
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
	}).trait("admin", { role: "admin" });

	let created = { authors: 0 };
	let ArticleFactory = defineFactory(Articles, {
		author_id: async ({ create }) => {
			created.authors++;
			return (await create(UserFactory)).id;
		},
		published_at: ({ sample }) => sample.date.past().toISOString(),
		meta: ({ sample }) => ({ title: sample.lorem.sentence(), slug: sample.lorem.slug() }),
	}).trait("draft", { published_at: null });

	let host = new RequestContext(new Request("https://example.com"));
	let outbox: string[] = [];
	host.set(OUTBOX, outbox);

	let { db } = openDatabase();
	let models = createModels({ users: Users, articles: Articles }).bind({ db }, host);
	let factories = createFactories(models, { seed, now: new Date("2026-06-01T00:00:00.000Z") });

	return { models, factories, UserFactory, ArticleFactory, created, outbox };
}

describe("factories", () => {
	test("create writes through the model, running its callbacks with the registry's host", async () => {
		let { factories, UserFactory, outbox } = setup(1);

		let user = await factories.create(UserFactory, "admin");

		expect(user).toMatchObject({ id: "id_0001", email: "user1@example.com", role: "admin" });
		expect(outbox).toEqual(["user1@example.com"]);
	});

	test("an override skips the attribute's function", async () => {
		let { factories, ArticleFactory, UserFactory, created } = setup(1);
		let author = await factories.create(UserFactory);

		await factories.createMany(ArticleFactory, 3, { author_id: author.id });

		expect(created.authors).toBe(0);
	});

	test("traits apply in order, before the call's overrides", async () => {
		let { factories, models, ArticleFactory, UserFactory } = setup(1);
		let author = await factories.create(UserFactory);

		await factories.createMany(ArticleFactory, 3, { author_id: author.id });
		let draft = await factories.create(ArticleFactory, "draft", { author_id: author.id });

		expect(draft.published_at).toBeNull();
		expect(draft.type).toBe("article");
		expect(await models.articles.query().where({ published_at: null }).count()).toBe(1);
	});

	test("the same seed reproduces the same values, whatever other factories do", async () => {
		let first = setup(42);
		let second = setup(42);
		await second.factories.create(second.UserFactory);

		let a = await first.factories.build(first.ArticleFactory, { author_id: "x" });
		let b = await second.factories.build(second.ArticleFactory, { author_id: "x" });

		expect(a).toEqual(b);
	});

	test("a write that fails throws, with the ValidationError as cause", async () => {
		let { factories, UserFactory } = setup(1);

		let failing = factories.create(UserFactory, { name: "" });

		await expect(failing).rejects.toThrow("Could not create a users record");
		await expect(failing).rejects.toHaveProperty("cause", expect.any(ValidationError));
	});
});
