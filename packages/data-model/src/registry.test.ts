/**
 * Acceptance tests for the registry and its hosts: entries binding on first access, lazily
 * loaded models answering through deferred queries, callbacks reaching other models, and the
 * router and job middleware publishing `ctx.models`, including to an MCP tool on the router.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createJobContext, job, jobs } from "@sdxc/jobs";
import * as s from "@sdxc/json-schema";
import { createHandler, LATEST_PROTOCOL_VERSION, MetaKey, tool, tools } from "@sdxc/mcp";
import { Pagination } from "@sdxc/pagination";
import { unwrap } from "@sdxc/result";
import { Query } from "remix/data-table";
import { createContextKey, createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { createIds, posts, users } from "./fixtures/schema.js";
import { openDatabase } from "./fixtures/sqlite.js";
import { models as jobModels } from "./jobs.js";
import { models as routerModels } from "./router.js";

import { createModel, createModels, Models } from "./index.js";

/** Builds the models and counts how often the lazy module is imported. */
function setup() {
	let ids = createIds();
	let imports = { articles: 0 };

	let Users = createModel(users, {
		optional: ["id", "role"],
		scopes: { active: (query) => query.where({ deleted_at: null }) },
		methods: (model) => ({
			findByEmail: (email: string) => model.active().where({ email }).first(),
		}),
		callbacks: {
			async beforeCreate(values) {
				return { ...values, id: values.id ?? ids(), role: values.role ?? "member" };
			},
			async afterCreate(row, ctx) {
				await ctx.models.articles.create({ author_id: row.id, published_at: null });
			},
		},
	});

	let Articles = createModel(posts, {
		constraints: { type: "article" },
		optional: ["id"],
		scopes: {
			drafts: (query) => query.where({ published_at: null }),
			newest: (query) => query.orderBy("id", "desc"),
		},
		methods: (model) => ({
			firstDraft: () => model.drafts().first(),
		}),
		callbacks: {
			async beforeCreate(values) {
				return { ...values, id: values.id ?? ids() };
			},
		},
	});

	let registry = createModels({
		users: Users,
		articles: async () => {
			imports.articles++;
			return { default: Articles };
		},
	});

	return { registry, imports, Users, Articles };
}

describe("registry", () => {
	test("an entry binds on first access and stays bound", () => {
		let { registry } = setup();
		let { db } = openDatabase();
		let models = registry.bind({ db });

		expect(models.users).toBe(models.users);
	});

	test("a lazy entry imports its module on the first call, once per binding", async () => {
		let { registry, imports } = setup();
		let { db } = openDatabase();
		let models = registry.bind({ db });

		expect(imports.articles).toBe(0);
		await models.articles.create({ author_id: "nobody", published_at: null }).catch(() => null);
		await models.articles.query().count();

		expect(imports.articles).toBe(1);
	});

	test("a callback reaches another model through ctx.models, lazy or not", async () => {
		let { registry } = setup();
		let { db } = openDatabase();
		let models = registry.bind({ db });

		let user = unwrap(await models.users.create({ email: "a@example.com", name: "A" }));

		expect(await models.articles.firstDraft()).toMatchObject({ author_id: user.id });
	});

	test("a deferred query chains and pages like an eager one", async () => {
		let { registry } = setup();
		let { db } = openDatabase();
		let models = registry.bind({ db });
		for (let index = 1; index <= 3; index++) {
			await models.users.create({ email: `u${index}@example.com`, name: `U${index}` });
		}

		let page = unwrap(
			await Pagination.byOffset(models.articles.drafts().newest(), { page: 1, perPage: 2 }),
		);

		expect(page.items.map((article) => article.id)).toEqual(["id_0006", "id_0004"]);
		expect(page.pagination.total).toBe(3);
	});

	test("load() answers the bound model, whose queries are real data-table queries", async () => {
		let { registry } = setup();
		let { db } = openDatabase();
		let models = registry.bind({ db });

		let articles = await models.articles.load();

		expect(articles.drafts()).toBeInstanceOf(Query);
	});

	test("a failed import rejects the call", async () => {
		let { Users } = setup();
		let { db } = openDatabase();
		let models = createModels({
			users: Users,
			broken: async (): Promise<{ default: typeof Users }> => {
				throw new Error("chunk failed to load");
			},
		}).bind({ db });

		await expect(models.broken.query().count()).rejects.toThrow("chunk failed to load");
	});

	test("inside a unit of work, a lazy model binds to it", async () => {
		let { registry } = setup();
		let { db } = openDatabase();
		let models = registry.bind({ db }, undefined, { transactions: "database" });

		let run = models.transaction(async (scoped) => {
			unwrap(await scoped.users.create({ email: "a@example.com", name: "A" }));
			throw new Error("rolled back");
		});

		await expect(run).rejects.toThrow("rolled back");
		expect(await models.articles.query().count()).toBe(0);
	});
});

describe("router middleware", () => {
	test("publishes ctx.models, building the model context once, on first access", async () => {
		let { registry } = setup();
		let { db } = openDatabase();
		let built = 0;
		let router = createRouter({
			middleware: [
				routerModels(registry, () => {
					built++;
					return { db };
				}),
			],
		});
		router.get("/none", () => new Response("untouched"));
		router.get("/users", async (ctx) => {
			unwrap(await ctx.models.users.create({ email: "a@example.com", name: "A" }));
			let found = await ctx.models.users.findByEmail("a@example.com");
			let byKey = ctx.get(Models);
			return Response.json({ name: found?.name, same: byKey === ctx.models });
		});

		await router.fetch(new Request("https://example.com/none"));
		expect(built).toBe(0);

		let response = await router.fetch(new Request("https://example.com/users"));
		expect(await response.json()).toEqual({ name: "A", same: true });
		expect(built).toBe(1);
	});

	test("an MCP tool mounted on the router reads ctx.models", async () => {
		let { registry } = setup();
		let { db } = openDatabase();
		let toolset = tools({
			countDrafts: tool("count_drafts", { description: "Counts drafts.", input: s.object({}) }),
		});
		let mcp = createHandler({ name: "test", version: "1.0.0" });
		mcp.tools.map(toolset.countDrafts, async (ctx) => {
			let models = ctx.get(Models);
			return String(await models?.articles.drafts().count());
		});
		let router = createRouter({ middleware: [routerModels(registry, () => ({ db }))] });
		router.post("/mcp", (ctx) => mcp.fetch(ctx));
		await registry.bind({ db }).users.create({ email: "a@example.com", name: "A" });

		let response = await router.fetch(
			new Request("https://example.com/mcp", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
					"Mcp-Method": "tools/call",
					"Mcp-Name": "count_drafts",
				},
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: 1,
					method: "tools/call",
					params: {
						name: "count_drafts",
						arguments: {},
						_meta: {
							[MetaKey.ProtocolVersion]: LATEST_PROTOCOL_VERSION,
							[MetaKey.ClientInfo]: { name: "test", version: "1.0.0" },
							[MetaKey.ClientCapabilities]: {},
						},
					},
				}),
			}),
		);
		let body = (await response.json()) as { result?: { content?: Array<{ text?: string }> } };

		expect(body.result?.content?.[0]?.text).toBe("1");
	});

	test("installs under another property when asked", async () => {
		let { registry } = setup();
		let { db } = openDatabase();
		let router = createRouter({
			middleware: [routerModels(registry, () => ({ db }), { property: "data" })],
		});
		router.get("/", async (ctx) => Response.json(await ctx.data.users.query().count()));

		let response = await router.fetch(new Request("https://example.com/"));

		expect(await response.json()).toBe(0);
	});
});

describe("job middleware", () => {
	test("publishes ctx.models to a job run, bound with the job's own host", async () => {
		let { registry } = setup();
		let { db } = openDatabase();
		let Greeting = createContextKey<string>();
		let Probe = createModel(users, {
			callbacks: {
				async afterCommit(_event, ctx) {
					seen.push(ctx.require(Greeting));
				},
			},
		});
		let seen: string[] = [];
		let probes = createModels({ users: Probe });
		let ctx = createJobContext(jobs({ probe: job() }).probe, { id: "m1", attempts: 1 });
		ctx.set(Greeting, "hello");

		await jobModels(probes, () => ({ db }))(ctx, async () => {
			let models = ctx.get(Models);
			unwrap(
				await models?.users.create({
					id: "u1",
					email: "a@example.com",
					name: "A",
					role: "member",
				}),
			);
		});

		expect(seen).toEqual(["hello"]);
		expect(await registry.bind({ db }).users.query().count()).toBe(1);
	});
});
