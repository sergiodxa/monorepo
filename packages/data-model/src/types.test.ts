/**
 * Type tests for the model surface: inputs inferred from the table and constraints, scopes
 * that refuse methods changing a query's type, and helpers generic over `AnyModel` resolving
 * members while the call site keeps the full row. `bun typecheck` is what enforces them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { ValidationError } from "@sdxc/validate";

import { describe, expectTypeOf, test } from "vitest";

import { comments, postMeta, posts, users } from "./fixtures/schema.js";
import { openDatabase } from "./fixtures/sqlite.js";

import type {
	AnyModel,
	BoundModel,
	BoundRegistry,
	InvalidModel,
	CreateValues,
	ModelQuery,
	ModelRow,
	NotFound,
	UpdateValues,
} from "./index.js";

import { createModel, createModels, field } from "./index.js";

const USERS = createModel(users, {
	optional: ["id", "role"],
	scopes: { active: (query) => query.where({ deleted_at: null }) },
	methods: {
		findByEmail(email: string) {
			return this.active().where({ email }).first();
		},
	},
});

const COMMENTS = createModel(comments, { optional: ["id"] });

const POSTS = createModel(posts, {
	inheritance: "type",
	optional: ["id"],
	metaTable: { table: postMeta, foreignKey: "post_id" },
	scopes: { live: (query) => query.where({ deleted_at: null }) },
});

const ARTICLES = POSTS.extend("article", {
	meta: {
		slug: field.text().required(),
		locale: field.enum(["en", "es"]).default("en"),
		tags: field.list(field.text()),
	},
});

/** Returns the row with `id`, or throws, as a route would answer 404. */
async function findOr404<M extends AnyModel>(
	model: BoundModel<M>,
	id: string,
): Promise<ModelRow<M>> {
	let row = await model.find(id);
	if (row === null) throw new Response(null, { status: 404 });
	return row;
}

/** Reads the rows of any model whose rows carry a `post_id`. */
async function forPost<M extends AnyModel<{ post_id: string }>>(
	model: BoundModel<M>,
	postId: string,
): Promise<ModelRow<M>[]> {
	let rows = await model.query().where({ post_id: postId }).all();
	for (let row of rows) expectTypeOf(row.post_id).toEqualTypeOf<string>();
	return rows;
}

const DB = openDatabase().db;

let userModel: BoundModel<typeof USERS> = USERS.bind({ db: DB });
let commentModel: BoundModel<typeof COMMENTS> = COMMENTS.bind({ db: DB });
let articles: BoundModel<typeof ARTICLES> = ARTICLES.bind({ db: DB });

describe("inputs", () => {
	test("create requires non-null columns and leaves nullable, timestamp and optional ones out", () => {
		expectTypeOf<CreateValues<typeof USERS>>().toEqualTypeOf<{
			email: string;
			name: string;
			id?: string;
			role?: "member" | "admin";
			deleted_at?: string | null;
			created_at?: string;
			updated_at?: string;
		}>();
	});

	test("update takes every column as optional", () => {
		expectTypeOf<UpdateValues<typeof USERS>>().toEqualTypeOf<{
			id?: string;
			email?: string;
			name?: string;
			role?: "member" | "admin";
			deleted_at?: string | null;
			created_at?: string;
			updated_at?: string;
		}>();
	});

	test("a sub-model's create omits the discriminator and requires its required meta", () => {
		expectTypeOf<CreateValues<typeof ARTICLES>>().not.toHaveProperty("type");
		expectTypeOf<CreateValues<typeof ARTICLES>["meta"]>().toEqualTypeOf<{
			slug: string;
			locale?: "en" | "es" | null;
			tags?: string[] | null;
		}>();
	});

	test("writes answer Results", () => {
		expectTypeOf<Awaited<ReturnType<(typeof userModel)["create"]>>>().toEqualTypeOf<
			Result<ModelRow<typeof USERS>, ValidationError>
		>();
		expectTypeOf<Awaited<ReturnType<(typeof userModel)["update"]>>>().toEqualTypeOf<
			Result<ModelRow<typeof USERS>, ValidationError | NotFound>
		>();
	});
});

describe("rows", () => {
	test("a sub-model's row narrows the discriminator and decodes meta", () => {
		expectTypeOf<ModelRow<typeof ARTICLES>["type"]>().toEqualTypeOf<"article">();
		expectTypeOf<ModelRow<typeof ARTICLES>["meta"]>().toEqualTypeOf<{
			slug: string | undefined;
			locale: "en" | "es";
			tags: string[] | undefined;
		}>();
	});

	test("the base model reads every type", () => {
		expectTypeOf<ModelRow<typeof POSTS>["type"]>().toEqualTypeOf<"article" | "like" | "tutorial">();
	});

	test("withMeta narrows the loaded keys", () => {
		let first = () => articles.query().withMeta(["slug"]).first();
		type Row = NonNullable<Awaited<ReturnType<typeof first>>>;
		expectTypeOf<Row["meta"]>().toEqualTypeOf<{ slug: string | undefined }>();
		expectTypeOf<Row["type"]>().toEqualTypeOf<"article">();
	});
});

describe("scopes", () => {
	test("scopes chain on the bound model and on its queries", () => {
		expectTypeOf(userModel.active().where({ name: "Pat" }).active()).toEqualTypeOf<
			ModelQuery<typeof USERS>
		>();
		expectTypeOf(articles.live().whereMeta("tags", "remix").live()).toEqualTypeOf<
			ModelQuery<typeof ARTICLES>
		>();
	});

	test("a scope calling with() or select() fails to type-check", () => {
		createModel(posts, {
			scopes: {
				// @ts-expect-error with() changes the loaded relations, which a scope must preserve
				loaded: (query) => query.with({}),
				// @ts-expect-error select() changes the row, which a scope must preserve
				projected: (query) => query.select("id"),
			},
		});
	});

	test("from() keeps only scopes built from where, orderBy, limit and offset", () => {
		let Grouped = createModel(posts, {
			scopes: {
				live: (query) => query.where({ deleted_at: null }),
				grouped: (query) => query.groupBy("author_id"),
			},
		});
		let bound = Grouped.bind({ db: DB });
		let wrapped = bound.from(bound.query());

		expectTypeOf(wrapped).toHaveProperty("live");
		expectTypeOf(wrapped).not.toHaveProperty("grouped");
	});

	test("a custom method returning a plain value turns the definition into an error", () => {
		let Bad = createModel(users, {
			methods: {
				answer() {
					return 42;
				},
			},
		});

		expectTypeOf(Bad).toEqualTypeOf<
			InvalidModel<"Custom methods must answer a promise or a model query: answer">
		>();
	});

	test("a method reaches the model's scopes and its other methods through this", () => {
		let Composed = createModel(users, {
			scopes: { active: (query) => query.where({ deleted_at: null }) },
			methods: {
				listActive() {
					return this.active().all();
				},
				async firstActive() {
					let rows = await this.listActive();
					return rows[0] ?? null;
				},
			},
		});
		let bound = Composed.bind({ db: DB });

		expectTypeOf<Awaited<ReturnType<(typeof bound)["firstActive"]>>>().toEqualTypeOf<ModelRow<
			typeof Composed
		> | null>();
	});

	test("unscoped() answers the same query type as query()", () => {
		expectTypeOf(userModel.unscoped()).toEqualTypeOf<ModelQuery<typeof USERS>>();
	});

	test("BoundRegistry names a registry's bound type, for augmenting a context", () => {
		let registry = createModels({ users: USERS, comments: COMMENTS });
		expectTypeOf<BoundRegistry<typeof registry>["users"]>().toEqualTypeOf<
			BoundModel<typeof USERS>
		>();
	});

	test("a sub-model scope named like a base scope fails to type-check", () => {
		let redeclare = () =>
			// @ts-expect-error `live` already names a base scope
			POSTS.extend("like", { scopes: { live: (query) => query.where({ deleted_at: null }) } });
		expectTypeOf(redeclare).toBeFunction();
	});
});

describe("helpers over any model", () => {
	test("a helper generic over AnyModel resolves find and keeps the caller's row", () => {
		expectTypeOf(() => findOr404(userModel, "id")).returns.resolves.toEqualTypeOf<
			ModelRow<typeof USERS>
		>();
		expectTypeOf(() => findOr404(articles, "id")).returns.resolves.toEqualTypeOf<
			ModelRow<typeof ARTICLES>
		>();
	});

	test("AnyModel<Shape> accepts only models whose rows have the shape", async () => {
		expectTypeOf(await forPost(commentModel, "p")).toEqualTypeOf<ModelRow<typeof COMMENTS>[]>();
		let wrong = () =>
			// @ts-expect-error users rows have no post_id
			forPost(userModel, "p");
		expectTypeOf(wrong).toBeFunction();
	});

	test("a registry types each entry as its bound model", () => {
		let models = createModels({
			users: USERS,
			articles: async () => ({ default: ARTICLES }),
		}).bind({ db: null as never });

		expectTypeOf<
			Awaited<ReturnType<(typeof models)["users"]["findByEmail"]>>
		>().toEqualTypeOf<ModelRow<typeof USERS> | null>();
		expectTypeOf(models.articles.live()).toEqualTypeOf<ModelQuery<typeof ARTICLES>>();
	});
});
