/**
 * Acceptance tests for the test factories: values reproducible from a seed and stable as other
 * factories change, overrides that skip an attribute's function, traits applied in order, and
 * records written through the model so its callbacks and constraints apply.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobContext, job, jobs } from "@sdxc/jobs";
import { failure, isFailure, unwrap } from "@sdxc/result";
import { ValidationError } from "@sdxc/validate";
import { fail } from "remix/data-table";
import { createContextKey, createRouter, RequestContext } from "remix/router";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createIds, postMeta, posts, users } from "./fixtures/schema.js";
import { openDatabase } from "./fixtures/sqlite.js";
import { models as routerModels } from "./router.js";
import { createFactories, defineFactory, overrideModel, publishModels } from "./testing.js";

import type { CreateValues } from "./index.js";

import { createModel, createModels, field, Models } from "./index.js";

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
				if (event.operation === "create") ctx.get(OUTBOX)?.push(event.row.email);
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

describe("overrideModel", () => {
	/** Removes the override a test installed, so the next test binds the real model. */
	let restore = () => {};
	afterEach(() => restore());

	/** A user model whose method writes through its own `create`. */
	function signUps() {
		return createModel(users, {
			methods: {
				signUp(email: string) {
					return this.create({ id: email, email, name: email, role: "member" });
				},
			},
		});
	}

	test("a wrapped member calls through, and the model's own methods reach the wrapper", async () => {
		let Users = signUps();
		let create = vi.fn();
		restore = overrideModel(Users, (users) => ({
			create: create.mockImplementation((values: CreateValues<typeof Users>) =>
				users.create(values),
			),
		}));
		let { db } = openDatabase();

		let user = unwrap(await Users.bind({ db }).signUp("a@example.com"));

		expect(user.email).toBe("a@example.com");
		expect(create).toHaveBeenCalledOnce();
	});

	test("a replaced member fails the write in a registry a router binds per request", async () => {
		let Users = signUps();
		restore = overrideModel(Users, () => ({
			create: async () => failure(new ValidationError([{ message: "Injected" }])),
		}));
		let { db } = openDatabase();
		let router = createRouter({
			middleware: [routerModels(createModels({ users: Users }), () => ({ db }))],
		});
		router.get("/", async (ctx) => {
			let result = await ctx.models.users.signUp("a@example.com");
			return Response.json(isFailure(result) ? result.error.issues : null);
		});

		let response = await router.fetch(new Request("https://example.com/"));

		expect(await response.json()).toEqual([{ message: "Injected" }]);
	});

	test("restoring binds the real model again", async () => {
		let Users = signUps();
		overrideModel(Users, () => ({ find: async () => null }))();
		let { db } = openDatabase();
		let users = Users.bind({ db });
		unwrap(await users.signUp("a@example.com"));

		expect(await users.find("a@example.com")).not.toBeNull();
	});
});

describe("publishModels", () => {
	test("publishes a registry on a hand-built job context as ctx.models", async () => {
		let Users = createModel(users);
		let { db } = openDatabase();
		let ctx = createJobContext(jobs({ probe: job() }).probe, { id: "m1", attempts: 1 });

		let models = publishModels(ctx, createModels({ users: Users }), { db });

		expect(ctx.get(Models)).toBe(models);
		expect((ctx as unknown as { models: unknown }).models).toBe(models);
		expect(await models.users.query().count()).toBe(0);
	});
});
