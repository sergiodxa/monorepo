/**
 * Acceptance tests for a bound model: scopes chaining into pagination, constraints and
 * sub-models sharing a table, the write `Result`s, callback ordering against the table's own
 * hooks, and constraint violations answered as `ValidationError`, on real SQLite.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyQuery, Database } from "remix/data-table";

import { InvalidOrderingError, Pagination } from "@sdxc/pagination";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { ValidationError } from "@sdxc/validate";
import { column as c, fail, lte, Query, sql, table } from "remix/data-table";
import { describe, expect, test } from "vitest";

import { createIds, postComments, posts, users } from "./fixtures/schema.js";
import { openDatabase } from "./fixtures/sqlite.js";

import { createModel, NotFound } from "./index.js";

/** Builds the models under test with a fresh id sequence, so each test starts from `id_0001`. */
function setup() {
	let ids = createIds();
	let calls: string[] = [];

	let Users = createModel(users, {
		optional: ["id", "role"],
		scopes: {
			active: (query) => query.where({ deleted_at: null }),
			admins: (query) => query.where({ role: "admin" }),
			named: (query, name: string) => query.where({ name }),
		},
		methods: {
			findByEmail(email: string) {
				return this.active().where({ email: email.toLowerCase() }).first();
			},
			newest() {
				return this.query().orderBy("created_at", "desc");
			},
		},
		callbacks: {
			async validate(values) {
				calls.push("validate");
				if (values.name === "") return fail("Name is required", ["name"]);
			},
			async beforeCreate(values) {
				calls.push("beforeCreate");
				return {
					...values,
					id: values.id ?? ids(),
					role: values.role ?? "member",
					email: values.email.toLowerCase(),
				};
			},
			async afterCreate(row) {
				calls.push(`afterCreate:${row.id}`);
			},
			async beforeUpdate(values, _ctx, before) {
				calls.push(`beforeUpdate:${before.name}`);
				return values;
			},
			async afterUpdate(row, _ctx, before) {
				calls.push(`afterUpdate:${before.name}->${row.name}`);
			},
			async beforeDelete(row) {
				calls.push(`beforeDelete:${row.id}`);
				if (row.role === "admin") return fail("Admins cannot be deleted");
			},
			async afterDelete(row) {
				calls.push(`afterDelete:${row.id}`);
			},
		},
	});

	let Posts = createModel(posts, {
		inheritance: "type",
		optional: ["id"],
		scopes: {
			live: (query) => query.where({ deleted_at: null }),
			published: (query) => query.where(lte("published_at", "2026-06-01T00:00:00.000Z")),
		},
		callbacks: {
			async beforeCreate(values) {
				return { ...values, id: values.id ?? ids() };
			},
			async beforeDelete(row) {
				if (row.federated_at !== null) return fail("Federated posts are retracted, not deleted");
			},
		},
	});

	let Articles = Posts.extend("article", {
		scopes: { by: (query, authorId: string) => query.where({ author_id: authorId }) },
		methods: {
			withComments(id: string) {
				return this.query().where({ id }).with({ comments: postComments }).first();
			},
		},
	});

	let Likes = Posts.extend("like", {});

	let { db, sqlite } = openDatabase();
	return { db, sqlite, calls, Users, Posts, Articles, Likes };
}

describe("binding and reading", () => {
	test("a bound model reads the database it was bound to", async () => {
		let { db, Users } = setup();
		let users = Users.bind({ db });

		let created = unwrap(await users.create({ email: "Pat@Example.com", name: "Pat" }));

		expect(created).toMatchObject({ id: "id_0001", email: "pat@example.com", role: "member" });
		expect(await users.find("id_0001")).toEqual(created);
		expect(await users.findBy({ email: "pat@example.com" })).toEqual(created);
		expect(await users.findByEmail("PAT@example.com")).toEqual(created);
	});

	test("reads answer null for a missing row", async () => {
		let { db, Users } = setup();
		let users = Users.bind({ db });

		expect(await users.find("nope")).toBeNull();
		expect(await users.findBy({ email: "nobody@example.com" })).toBeNull();
	});

	test("scopes chain with each other and with data-table methods, in any order", async () => {
		let { db, Users } = setup();
		let users = Users.bind({ db });
		await users.create({ email: "a@example.com", name: "Ada", role: "admin" });
		await users.create({ email: "b@example.com", name: "Bob" });
		let gone = unwrap(await users.create({ email: "c@example.com", name: "Cy", role: "admin" }));
		await users.query().where({ id: gone.id }).update({ deleted_at: "2026-01-02T00:00:00.000Z" });

		let admins = await users.active().admins().orderBy("name", "asc").all();
		let reordered = await users.query().orderBy("name", "asc").admins().active().all();
		let named = await users.named("Bob").active().first();

		expect(admins.map((user) => user.name)).toEqual(["Ada"]);
		expect(reordered).toEqual(admins);
		expect(named?.email).toBe("b@example.com");
	});

	test("a scoped query is still a data-table Query and pages with Pagination.byOffset", async () => {
		let { db, Users } = setup();
		let users = Users.bind({ db });
		for (let index = 1; index <= 5; index++) {
			await users.create({ email: `u${index}@example.com`, name: `User ${index}` });
		}

		let query = users.active().orderBy("email", "asc");
		let page = unwrap(await Pagination.byOffset(query, { page: 2, perPage: 2 }));

		expect(query).toBeInstanceOf(Query);
		expect(page.items.map((user) => user.email)).toEqual(["u3@example.com", "u4@example.com"]);
		expect(page.pagination.total).toBe(5);
	});

	test("an ordering scope handed to keyset paging is refused rather than paged on the wrong key", async () => {
		let { db, Users } = setup();
		let users = Users.bind({ db });

		let page = await Pagination.byKeyset(users.newest(), {
			orderBy: [
				["email", "asc"],
				["id", "asc"],
			],
			limit: 2,
		});

		expect(isFailure(page) && page.error).toBeInstanceOf(InvalidOrderingError);
	});

	test("db.exec runs a scoped query, since the wrapper forwards the query's snapshot", async () => {
		let { db, Users } = setup();
		let users = Users.bind({ db });
		await users.create({ email: "a@example.com", name: "Ada" });

		let rows = await db.exec(users.active() as unknown as AnyQuery);

		expect(rows).toHaveLength(1);
	});

	test("a custom method can return a model query that chains further", async () => {
		let { db, Users } = setup();
		let users = Users.bind({ db });
		await users.create({ email: "a@example.com", name: "Ada", role: "admin" });
		await users.create({ email: "b@example.com", name: "Bob" });

		let rows = await users.newest().admins().all();

		expect(rows.map((user) => user.name)).toEqual(["Ada"]);
	});
});

describe("writes", () => {
	test("update answers the row after the write and runs the update callbacks", async () => {
		let { db, Users, calls } = setup();
		let users = Users.bind({ db });
		let pat = unwrap(await users.create({ email: "pat@example.com", name: "Pat" }));

		let updated = unwrap(await users.update(pat.id, { name: "Patricia" }));

		expect(updated.name).toBe("Patricia");
		expect(updated.updated_at > pat.updated_at).toBe(true);
		expect(calls).toContain("beforeUpdate:Pat");
		expect(calls).toContain("afterUpdate:Pat->Patricia");
	});

	test("update and delete of a missing key answer NotFound", async () => {
		let { db, Users } = setup();
		let users = Users.bind({ db });

		let updated = await users.update("nope", { name: "X" });
		let deleted = await users.delete("nope");

		expect(isFailure(updated) && updated.error).toBeInstanceOf(NotFound);
		expect(isFailure(deleted) && deleted.error).toBeInstanceOf(NotFound);
	});

	test("delete answers the deleted row, and a beforeDelete refusal keeps it", async () => {
		let { db, Users, calls } = setup();
		let users = Users.bind({ db });
		let member = unwrap(await users.create({ email: "m@example.com", name: "Member" }));
		let admin = unwrap(
			await users.create({ email: "a@example.com", name: "Admin", role: "admin" }),
		);

		let deleted = await users.delete(member.id);
		let refused = await users.delete(admin.id);

		expect(deleted).toEqual({ status: "success", data: member });
		expect(await users.find(member.id)).toBeNull();
		expect(isFailure(refused) && refused.error).toBeInstanceOf(ValidationError);
		expect(await users.find(admin.id)).not.toBeNull();
		expect(calls).toContain(`afterDelete:${member.id}`);
		expect(calls).not.toContain(`afterDelete:${admin.id}`);
	});

	test("validate runs first and its failure stops the write before any statement", async () => {
		let { db, Users, calls } = setup();
		let users = Users.bind({ db });

		let result = await users.create({ email: "e@example.com", name: "" });

		expect(isFailure(result) && result.error.issues).toEqual([
			{ message: "Name is required", path: ["name"] },
		]);
		expect(calls).toEqual(["validate"]);
		expect(await users.query().count()).toBe(0);
	});

	test("model callbacks run around the table's own hooks", async () => {
		let order: string[] = [];
		let audited = table({
			name: "users",
			columns: {
				id: c.text().primaryKey(),
				email: c.text(),
				name: c.text(),
				role: c.text(),
				deleted_at: c.text().nullable(),
				created_at: c.text(),
				updated_at: c.text(),
			},
			timestamps: true,
			beforeWrite: ({ value }) => {
				order.push("table.beforeWrite");
				return { value };
			},
			afterWrite: () => {
				order.push("table.afterWrite");
			},
		});
		let Audited = createModel(audited, {
			callbacks: {
				async validate() {
					order.push("validate");
				},
				async beforeCreate() {
					order.push("beforeCreate");
				},
				async afterCreate() {
					order.push("afterCreate");
				},
				async afterCommit() {
					order.push("afterCommit");
				},
			},
		});
		let { db } = openDatabase();

		unwrap(
			await Audited.bind({ db }).create({ id: "u1", email: "a@example.com", name: "A", role: "x" }),
		);

		expect(order).toEqual([
			"validate",
			"beforeCreate",
			"table.beforeWrite",
			"table.afterWrite",
			"afterCreate",
			"afterCommit",
		]);
	});

	test("a table validate failure comes back as a ValidationError", async () => {
		let strict = table({
			name: "users",
			columns: {
				id: c.text().primaryKey(),
				email: c.text(),
				name: c.text(),
				role: c.text(),
				deleted_at: c.text().nullable(),
				created_at: c.text(),
				updated_at: c.text(),
			},
			timestamps: true,
			validate: ({ value }) =>
				value.email?.includes("@") === false ? fail("Not an email", ["email"]) : { value },
		});
		let { db } = openDatabase();

		let result = await createModel(strict)
			.bind({ db })
			.create({ id: "u1", email: "nope", name: "A", role: "x" });

		expect(isFailure(result) && result.error).toBeInstanceOf(ValidationError);
		expect(isFailure(result) && result.error.issues).toEqual([
			{ message: "Not an email", path: ["email"] },
		]);
	});

	test("a unique violation comes back as a ValidationError at the indexed column", async () => {
		let { db, Users } = setup();
		let users = Users.bind({ db });
		await users.create({ email: "pat@example.com", name: "Pat" });

		let duplicate = await users.create({ email: "PAT@example.com", name: "Other Pat" });

		expect(isFailure(duplicate) && duplicate.error).toBeInstanceOf(ValidationError);
		expect(isFailure(duplicate) && duplicate.error.issues).toEqual([
			{ message: "Already taken", path: ["email"] },
		]);
	});

	test("a foreign-key violation comes back as a ValidationError", async () => {
		let { db, Articles } = setup();

		let orphan = await Articles.bind({ db }).create({ author_id: "missing", published_at: null });

		expect(isFailure(orphan) && orphan.error).toBeInstanceOf(ValidationError);
	});

	test("upsert creates when nothing conflicts and updates when a row does", async () => {
		let { db, Users, calls } = setup();
		let users = Users.bind({ db });

		let created = unwrap(await users.upsert({ id: "u1", email: "a@example.com", name: "Ada" }));
		let updated = unwrap(await users.upsert({ id: "u1", email: "a@example.com", name: "Ada L." }));

		expect(created.name).toBe("Ada");
		expect(updated.name).toBe("Ada L.");
		expect(await users.query().count()).toBe(1);
		expect(calls).toContain("beforeCreate");
		expect(calls).toContain("beforeUpdate:Ada");
	});

	test("a bulk write built from a query runs no model callbacks", async () => {
		let { db, Users, calls } = setup();
		let users = Users.bind({ db });
		await users.create({ email: "a@example.com", name: "Ada" });
		await users.create({ email: "b@example.com", name: "Bob" });
		calls.length = 0;

		await users.active().update({ name: "Renamed" });
		await users.query().where({ email: "b@example.com" }).delete();

		expect(calls).toEqual([]);
		expect((await users.query().all()).map((user) => user.name)).toEqual(["Renamed"]);
	});
});

describe("default scopes", () => {
	/** A user model hiding soft-deleted rows from every read, and a sub-model stacking another. */
	function softDeleting() {
		let Users = createModel(users, {
			defaultScope: (query) => query.where({ deleted_at: null }),
			methods: {
				listAll() {
					return this.query().orderBy("id", "asc").all();
				},
				async countAll() {
					let rows = await this.listAll();
					return rows.length;
				},
			},
		});
		let Posts = createModel(posts, {
			inheritance: "type",
			defaultScope: (query) => query.where({ deleted_at: null }),
		});
		let Published = Posts.extend("article", {
			defaultScope: (query) => query.where(lte("published_at", "2026-06-01T00:00:00.000Z")),
		});
		let { db } = openDatabase();
		return { users: Users.bind({ db }), published: Published.bind({ db }), db };
	}

	/** Seeds one live and one soft-deleted user. */
	async function seed(db: Database) {
		await db.create(users, { id: "live", email: "l@example.com", name: "L", role: "member" });
		await db.create(users, {
			id: "gone",
			email: "g@example.com",
			name: "G",
			role: "member",
			deleted_at: "2026-01-01T00:00:00.000Z",
		});
	}

	test("every read applies it, and unscoped() leaves it off", async () => {
		let { users: model, db } = softDeleting();
		await seed(db);

		expect((await model.query().all()).map((user) => user.id)).toEqual(["live"]);
		expect(await model.find("gone")).toBeNull();
		expect(await model.findBy({ email: "g@example.com" })).toBeNull();
		expect(await model.unscoped().count()).toBe(2);
	});

	test("an update or delete of a row it hides answers NotFound", async () => {
		let { users: model, db } = softDeleting();
		await seed(db);

		let updated = await model.update("gone", { name: "Back" });
		let deleted = await model.delete("gone");

		expect(isFailure(updated) && updated.error).toBeInstanceOf(NotFound);
		expect(isFailure(deleted) && deleted.error).toBeInstanceOf(NotFound);
		expect(await model.unscoped().where({ id: "gone" }).count()).toBe(1);
	});

	test("a method calls another method of the same model through this", async () => {
		let { users: model, db } = softDeleting();
		await seed(db);

		expect(await model.countAll()).toBe(1);
	});

	test("a method runs a raw statement through this.db, inside the unit of work it joins", async () => {
		let Renaming = createModel(users, {
			methods: {
				async renameAll(name: string) {
					await this.db.exec(sql`update "users" set "name" = ${name}`);
				},
			},
		});
		let { db } = openDatabase();
		await seed(db);
		let model = Renaming.bind({ db }, undefined, { transactions: "database" });

		await model.renameAll("Everyone");
		let rolledBack = model.transaction(async (scoped) => {
			await (scoped as unknown as { users: typeof model }).users.renameAll("Nobody");
			throw new Error("abort");
		});

		await expect(rolledBack).rejects.toThrow("abort");
		expect((await model.unscoped().all()).map((user) => user.name)).toEqual([
			"Everyone",
			"Everyone",
		]);
	});

	test("a sub-model's default scope applies after the base's", async () => {
		let { published, db } = softDeleting();
		await seed(db);
		let row = { author_id: "live", type: "article" as const };
		await db.create(posts, { ...row, id: "draft", published_at: null });
		await db.create(posts, { ...row, id: "out", published_at: "2026-01-01T00:00:00.000Z" });
		await db.create(posts, {
			...row,
			id: "removed",
			published_at: "2026-01-01T00:00:00.000Z",
			deleted_at: "2026-02-01T00:00:00.000Z",
		});

		expect((await published.query().all()).map((post) => post.id)).toEqual(["out"]);
	});
});

describe("constraints and sub-models", () => {
	test("a sub-model writes its discriminator and reads only its own rows", async () => {
		let { db, Users, Posts, Articles, Likes } = setup();
		let author = unwrap(await Users.bind({ db }).create({ email: "a@example.com", name: "A" }));
		let articles = Articles.bind({ db });
		let likes = Likes.bind({ db });

		let article = unwrap(await articles.create({ author_id: author.id, published_at: null }));
		let like = unwrap(await likes.create({ author_id: author.id, published_at: null }));

		expect(article.type).toBe("article");
		expect(like.type).toBe("like");
		expect(await articles.find(like.id)).toBeNull();
		expect((await articles.query().all()).map((post) => post.id)).toEqual([article.id]);
		expect(await Posts.bind({ db }).query().count()).toBe(2);
	});

	test("a key of another type answers NotFound and the discriminator never changes", async () => {
		let { db, Users, Articles, Likes } = setup();
		let author = unwrap(await Users.bind({ db }).create({ email: "a@example.com", name: "A" }));
		let like = unwrap(
			await Likes.bind({ db }).create({ author_id: author.id, published_at: null }),
		);
		let articles = Articles.bind({ db });

		let updated = await articles.update(like.id, { published_at: "2026-01-01T00:00:00.000Z" });
		let retyped = await Likes.bind({ db }).update(like.id, { type: "article" } as never);

		expect(isFailure(updated) && updated.error).toBeInstanceOf(NotFound);
		expect(isSuccess(retyped) && retyped.data.type).toBe("like");
	});

	test("a sub-model has the base's scopes, and the base's callbacks run first", async () => {
		let { db, Users, Articles } = setup();
		let author = unwrap(await Users.bind({ db }).create({ email: "a@example.com", name: "A" }));
		let articles = Articles.bind({ db });
		let federated = unwrap(
			await articles.create({
				author_id: author.id,
				published_at: "2026-01-01T00:00:00.000Z",
				federated_at: "2026-01-02T00:00:00.000Z",
			}),
		);

		let published = await articles.live().published().by(author.id).all();
		let refused = await articles.delete(federated.id);

		expect(published.map((post) => post.id)).toEqual([federated.id]);
		expect(isFailure(refused) && refused.error.message).toBe("Validation Error");
	});

	test("from() applies the constraints and the model's scopes to another package's query", async () => {
		let { db, Users, Articles, Likes } = setup();
		let author = unwrap(await Users.bind({ db }).create({ email: "a@example.com", name: "A" }));
		let articles = Articles.bind({ db });
		await articles.create({ author_id: author.id, published_at: "2026-01-01T00:00:00.000Z" });
		await articles.create({ author_id: author.id, published_at: null });
		await Likes.bind({ db }).create({
			author_id: author.id,
			published_at: "2026-01-01T00:00:00.000Z",
		});

		let rows = await articles.from(db.query(posts)).published().all();

		expect(rows).toHaveLength(1);
		expect(rows[0]?.type).toBe("article");
	});

	test("a custom method eager-loads relations with()", async () => {
		let { db, Users, Articles } = setup();
		let author = unwrap(await Users.bind({ db }).create({ email: "a@example.com", name: "A" }));
		let article = unwrap(
			await Articles.bind({ db }).create({ author_id: author.id, published_at: null }),
		);
		await db.create(postComments.targetTable, { id: "c1", post_id: article.id, body: "Hi" });

		let loaded = await Articles.bind({ db }).withComments(article.id);

		expect(loaded?.comments.map((comment) => comment.body)).toEqual(["Hi"]);
	});
});
