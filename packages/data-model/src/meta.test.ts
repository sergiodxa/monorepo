/**
 * Acceptance tests for meta fields over a key/value table: decoding with defaults, `withMeta`
 * and `whereMeta`, partial writes that remove keys with `null`, latest-row resolution, keys the
 * model does not declare left alone, and a create on D1 leaving no row when its meta fails.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { createD1Database } from "@sdxc/cloudflare-mocks";
import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { Pagination } from "@sdxc/pagination";
import { isFailure, unwrap } from "@sdxc/result";
import { ValidationError } from "@sdxc/validate";
import { object, string } from "remix/data-schema";
import { Database as DataTable } from "remix/data-table";
import { describe, expect, test } from "vitest";

import { intercept } from "./fixtures/intercept.js";
import {
	createClock,
	createIds,
	postMeta,
	posts,
	SCHEMA_STATEMENTS,
	users,
} from "./fixtures/schema.js";
import { openDatabase } from "./fixtures/sqlite.js";

import { createModel, field } from "./index.js";

/** Builds a post model with typed meta, plus an author to own the posts. */
async function setup(db: Database) {
	let ids = createIds();
	let Posts = createModel(posts, {
		inheritance: "type",
		optional: ["id"],
		metaTable: { table: postMeta, foreignKey: "post_id", generateId: createIds("meta") },
		callbacks: {
			async beforeCreate(values) {
				return { ...values, id: values.id ?? ids() };
			},
		},
	});
	let Articles = Posts.extend("article", {
		meta: {
			slug: field.text().required(),
			title: field.text(),
			locale: field.enum(["en", "es"]).default("en"),
			reading_minutes: field.integer(),
			canonical_url: field.url(),
			tags: field.list(field.text()),
			cover: field.json(object({ src: string(), alt: string() })),
			featured: field.boolean().default(false),
		},
	});
	let Likes = Posts.extend("like", { meta: { target: field.url().required() } });

	await db.create(users, {
		id: "author",
		email: "a@example.com",
		name: "A",
		role: "member",
	});

	return {
		posts: Posts.bind({ db }),
		articles: Articles.bind({ db }),
		likes: Likes.bind({ db }),
	};
}

/** Counts the meta rows stored under one key for one post. */
async function metaRows(db: Database, postId: string, key: string): Promise<number> {
	return db.count(postMeta, { where: { post_id: postId, key } });
}

describe("reading", () => {
	test("rows carry decoded meta, with defaults for missing keys", async () => {
		let { db } = openDatabase();
		let { articles } = await setup(db);

		let article = unwrap(
			await articles.create({
				author_id: "author",
				published_at: null,
				meta: { slug: "hello", reading_minutes: 4, tags: ["remix", "data"] },
			}),
		);

		expect(article.meta).toEqual({
			slug: "hello",
			title: undefined,
			locale: "en",
			reading_minutes: 4,
			canonical_url: undefined,
			tags: ["remix", "data"],
			cover: undefined,
			featured: false,
		});
		expect(await articles.find(article.id)).toEqual(article);
	});

	test("withMeta loads only the named keys, and a projection loads none", async () => {
		let { db } = openDatabase();
		let { articles } = await setup(db);
		await articles.create({
			author_id: "author",
			published_at: null,
			meta: { slug: "hello", title: "Hello" },
		});

		let narrowed = await articles.query().withMeta(["title"]).first();
		let none = await articles.query().withMeta([]).first();
		let projected = await articles.query().select("id").first();

		expect(narrowed?.meta).toEqual({ title: "Hello" });
		expect(none?.meta).toEqual({});
		expect(projected).toEqual({ id: "id_0001" });
	});

	test("paged rows carry meta, with one meta query per page", async () => {
		let { db, operations } = openInterceptedD1();
		let { articles } = await setup(await db);
		for (let index = 1; index <= 5; index++) {
			await articles.create({
				author_id: "author",
				published_at: null,
				meta: { slug: `post-${index}`, title: `Post ${index}` },
			});
		}
		operations.length = 0;

		let page = unwrap(
			await Pagination.byOffset(articles.query().orderBy("id", "asc"), { page: 2, perPage: 2 }),
		);

		expect(page.items.map((post) => post.meta.slug)).toEqual(["post-3", "post-4"]);
		expect(operations.filter((operation) => operation.table === "post_meta")).toHaveLength(1);
	});

	test("the latest row of a key wins, and a value the codec rejects reads as missing", async () => {
		let { db } = openDatabase();
		let { articles } = await setup(db);
		let article = unwrap(
			await articles.create({ author_id: "author", published_at: null, meta: { slug: "a" } }),
		);
		await db.create(postMeta, { id: "zz_1", post_id: article.id, key: "title", value: "Old" });
		await db.create(postMeta, { id: "zz_2", post_id: article.id, key: "title", value: "New" });
		await db.create(postMeta, { id: "zz_3", post_id: article.id, key: "locale", value: "fr" });
		await db.create(postMeta, {
			id: "zz_4",
			post_id: article.id,
			key: "reading_minutes",
			value: "x",
		});

		let read = await articles.find(article.id);

		expect(read?.meta.title).toBe("New");
		expect(read?.meta.locale).toBe("en");
		expect(read?.meta.reading_minutes).toBeUndefined();
	});
});

describe("querying by meta", () => {
	test("whereMeta matches a value, any of a list of values, or any item of a list field", async () => {
		let { db } = openDatabase();
		let { articles } = await setup(db);
		let first = unwrap(
			await articles.create({
				author_id: "author",
				published_at: null,
				meta: { slug: "first", locale: "es", tags: ["remix"] },
			}),
		);
		let second = unwrap(
			await articles.create({
				author_id: "author",
				published_at: null,
				meta: { slug: "second", tags: ["data", "remix"] },
			}),
		);

		let bySlug = await articles.whereMeta("slug", "second").first();
		let anySlug = await articles.whereMeta("slug", ["first", "second"]).count();
		let tagged = await articles.whereMeta("tags", "data").all();
		let both = await articles.whereMeta("tags", "remix").whereMeta("locale", "es").all();
		let none = await articles.whereMeta("slug", "missing").all();

		expect(bySlug?.id).toBe(second.id);
		expect(anySlug).toBe(2);
		expect(tagged.map((post) => post.id)).toEqual([second.id]);
		expect(both.map((post) => post.id)).toEqual([first.id]);
		expect(none).toEqual([]);
	});

	test("whereMeta only sees the model's own rows", async () => {
		let { db } = openDatabase();
		let { articles, likes } = await setup(db);
		await likes.create({
			author_id: "author",
			published_at: null,
			meta: { target: "https://example.com/a" },
		});
		await db.create(postMeta, { id: "zz_1", post_id: "id_0001", key: "slug", value: "liked" });

		expect(await articles.whereMeta("slug", "liked").all()).toEqual([]);
	});
});

describe("writing", () => {
	test("a required field is refused when missing, and an invalid value at its path", async () => {
		let { db } = openDatabase();
		let { articles } = await setup(db);

		let missing = await articles.create({ author_id: "author", published_at: null } as never);
		let invalid = await articles.create({
			author_id: "author",
			published_at: null,
			meta: { slug: "a", canonical_url: "not a url" },
		});

		expect(isFailure(missing) && missing.error.issues).toEqual([
			{ message: "Required", path: ["meta", "slug"] },
		]);
		expect(isFailure(invalid) && invalid.error.issues).toEqual([
			{ message: "Expected an absolute URL", path: ["meta", "canonical_url"] },
		]);
		expect(await articles.query().count()).toBe(0);
	});

	test("an update touches only the named keys, and null removes one", async () => {
		let { db } = openDatabase();
		let { articles } = await setup(db);
		let article = unwrap(
			await articles.create({
				author_id: "author",
				published_at: null,
				meta: { slug: "a", title: "Hello", tags: ["one", "two"] },
			}),
		);

		let updated = unwrap(
			await articles.update(article.id, { meta: { title: "Hello, world", tags: null } }),
		);

		expect(updated.meta).toMatchObject({ slug: "a", title: "Hello, world", tags: undefined });
		expect(await metaRows(db, article.id, "title")).toBe(1);
		expect(await metaRows(db, article.id, "tags")).toBe(0);
	});

	test("a required field cannot be set to null", async () => {
		let { db } = openDatabase();
		let { articles } = await setup(db);
		let article = unwrap(
			await articles.create({ author_id: "author", published_at: null, meta: { slug: "a" } }),
		);

		let result = await articles.update(article.id, { meta: { slug: null } as never });

		expect(
			isFailure(result) && result.error instanceof ValidationError && result.error.issues,
		).toEqual([{ message: "Required", path: ["meta", "slug"] }]);
	});

	test("keys the model does not declare are left alone", async () => {
		let { db } = openDatabase();
		let { articles } = await setup(db);
		let article = unwrap(
			await articles.create({ author_id: "author", published_at: null, meta: { slug: "a" } }),
		);
		await db.create(postMeta, { id: "zz_1", post_id: article.id, key: "legacy", value: "kept" });

		await articles.update(article.id, { meta: { title: "T" } });

		expect(await metaRows(db, article.id, "legacy")).toBe(1);
	});

	test("afterCommit names changed meta keys as meta.<key>", async () => {
		let { db } = openDatabase();
		let changes: string[][] = [];
		let Tracked = createModel(posts, {
			optional: ["id"],
			constraints: { type: "article" },
			metaTable: { table: postMeta, foreignKey: "post_id", generateId: createIds("meta") },
			meta: { title: field.text(), slug: field.text() },
			callbacks: {
				async beforeCreate(values) {
					return { ...values, id: values.id ?? "p1" };
				},
				async afterCommit(event) {
					if (event.operation === "update") changes.push(event.changed);
				},
			},
		});
		await setup(db);
		let tracked = Tracked.bind({ db });
		unwrap(await tracked.create({ author_id: "author", published_at: null, meta: { slug: "a" } }));

		await tracked.update("p1", { meta: { title: "New", slug: "a" } });

		expect(changes).toEqual([["meta.title"]]);
	});

	test("a JSON field is validated by its schema", async () => {
		let { db } = openDatabase();
		let { articles } = await setup(db);

		let valid = await articles.create({
			author_id: "author",
			published_at: null,
			meta: { slug: "a", cover: { src: "/a.png", alt: "A" } },
		});
		let invalid = await articles.create({
			author_id: "author",
			published_at: null,
			meta: { slug: "b", cover: { src: "/b.png" } as never },
		});

		expect(unwrap(valid).meta.cover).toEqual({ src: "/a.png", alt: "A" });
		expect(isFailure(invalid) && invalid.error.issues[0]?.path).toEqual(["meta", "cover"]);
	});

	test("deleting a post deletes its meta", async () => {
		let { db } = openDatabase();
		let { articles } = await setup(db);
		let article = unwrap(
			await articles.create({ author_id: "author", published_at: null, meta: { slug: "a" } }),
		);

		unwrap(await articles.delete(article.id));

		expect(await db.count(postMeta)).toBe(0);
	});
});

/** Opens the schema on the D1 mock through an intercepted driver. */
function openInterceptedD1() {
	let binding = createD1Database();
	let intercepted = intercept(createD1DatabaseAdapter(binding));
	let db = (async () => {
		for (let statement of SCHEMA_STATEMENTS) await binding.exec(statement);
		await binding.exec("pragma foreign_keys = on");
		return new DataTable(intercepted.driver, { now: createClock() });
	})();
	return { db, ...intercepted };
}

describe("on D1, where every statement commits as it runs", () => {
	test("a create whose meta fails deletes the owner row it wrote", async () => {
		let { db: opened, failWhen } = openInterceptedD1();
		let db = await opened;
		let { articles } = await setup(db);
		failWhen((kind, table) => kind === "insertMany" && table === "post_meta");

		let created = articles.create({ author_id: "author", published_at: null, meta: { slug: "a" } });

		await expect(created).rejects.toThrow();
		expect(await db.count(posts)).toBe(0);
	});
});
