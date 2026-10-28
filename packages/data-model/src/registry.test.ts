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
import { createHandler, LATEST_PROTOCOL_VERSION, MetaKey, tool, tools } from "@sdxc/mcp/server";
import { Pagination } from "@sdxc/pagination";
import { unwrap } from "@sdxc/result";
import { Query } from "remix/data-table";
import { createContextKey, createRouter } from "remix/router";
import { describe, expect, test } from "vitest";

import { createIds, posts, users } from "./fixtures/schema.js";
import { openDatabase } from "./fixtures/sqlite.js";
import { models as jobModels } from "./jobs.js";
import { models as routerModels } from "./router.js";

import type { AnyBoundModels, BoundModels, ModelContext } from "./index.js";

import { createModel, createModels, Models, withContext } from "./index.js";

/** Builds the models and counts how often the lazy module is imported. */
function setup() {
	let ids = createIds();
	let imports = { articles: 0 };

	let Users = createModel(users, {
		optional: ["id", "role"],
		scopes: { active: (query) => query.where({ deleted_at: null }) },
		methods: {
			findByEmail(email: string) {
				return this.active().where({ email }).first();
			},
		},
		callbacks: {
			async beforeCreate(values) {
				return { ...values, id: values.id ?? ids(), role: values.role ?? "member" };
			},
			async afterCreate(row, ctx) {
				let models = (ctx as typeof ctx & { models: AnyBoundModels }).models;
				await models.articles.create({ author_id: row.id, published_at: null });
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
		methods: {
			firstDraft() {
				return this.drafts().first();
			},
		},
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

	test("a failed import rejects a chained call once, leaving no unhandled rejection", async () => {
		let { Users } = setup();
		let { db } = openDatabase();
		let models = createModels({
			users: Users,
			broken: async (): Promise<{ default: typeof Users }> => {
				throw new Error("chunk failed to load");
			},
		}).bind({ db });
		let unhandled: unknown[] = [];
		let record = (reason: unknown) => void unhandled.push(reason);
		process.on("unhandledRejection", record);

		try {
			await expect(models.broken.active().where({ name: "A" }).count()).rejects.toThrow(
				"chunk failed to load",
			);
			await new Promise((resolve) => setTimeout(resolve, 10));
		} finally {
			process.off("unhandledRejection", record);
		}

		expect(unhandled).toEqual([]);
	});

	test("a lazy model's async method answers a real promise, so instanceof checks hold", async () => {
		let { registry } = setup();
		let { db } = openDatabase();
		let models = registry.bind({ db });

		let call = models.articles.query().count();
		let firstDraft = models.articles.firstDraft();

		expect(call).toBeInstanceOf(Promise);
		expect(firstDraft).toBeInstanceOf(Promise);
		expect(await firstDraft).toBeNull();
	});

	test("a lazy model's write runs even when the caller never awaits it", async () => {
		let { registry } = setup();
		let { db } = openDatabase();
		let models = registry.bind({ db });
		let author = unwrap(await models.users.create({ email: "a@example.com", name: "A" }));

		void models.articles.create({ author_id: author.id, published_at: null });
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(await models.articles.query().count()).toBe(2);
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

/** The context the probe registry's models are typed with: its own models and an audit log. */
interface ProbeContext extends ModelContext {
	models: BoundModels<ProbeModels>;
	audit: string[];
}

/** The probe registry's entries, which `ctx.models` resolves one at a time. */
interface ProbeModels {
	users: typeof PROBE_USERS;
	articles: () => Promise<{ default: typeof PROBE_ARTICLES }>;
}

const { createModel: createProbeModel } = withContext<ProbeContext>();

const PROBE_ARTICLES = createProbeModel(posts, {
	constraints: { type: "article" },
	optional: ["id"],
	methods: {
		async draftFor(authorId: string) {
			this.context.audit.push(`draft:${authorId}`);
			return this.create({ id: `a-${authorId}`, author_id: authorId, published_at: null });
		},
	},
});

const PROBE_USERS = createProbeModel(users, {
	methods: {
		async signUp(email: string) {
			let user = unwrap(await this.create({ id: email, email, name: email, role: "member" }));
			let draft = await this.context.models.articles.draftFor(user.id);
			return { user, draft };
		},
	},
});

describe("methods reaching the context", () => {
	/** Binds the probe registry, its articles entry loaded lazily. */
	function bindProbes(audit: string[], options?: { transactions: "database" }) {
		let { db } = openDatabase();
		let registry = createModels({
			users: PROBE_USERS,
			articles: async () => ({ default: PROBE_ARTICLES }),
		});
		return { db, models: registry.bind({ db, audit }, undefined, options) };
	}

	test("a method reaches a sibling model and the members the binding supplied", async () => {
		let audit: string[] = [];
		let { models } = bindProbes(audit);

		let { draft } = await models.users.signUp("a@example.com");

		expect(unwrap(draft)).toMatchObject({ author_id: "a@example.com", type: "article" });
		expect(audit).toEqual(["draft:a@example.com"]);
	});

	test("inside a unit of work, this.context.models binds to it", async () => {
		let { models } = bindProbes([], { transactions: "database" });

		let run = models.transaction(async (scoped) => {
			await scoped.users.signUp("a@example.com");
			throw new Error("rolled back");
		});

		await expect(run).rejects.toThrow("rolled back");
		expect(await models.articles.query().count()).toBe(0);
	});

	test("a lazy entry answers db and context before its module loads", async () => {
		let { registry, imports } = setup();
		let { db } = openDatabase();
		let models = registry.bind({ db });

		expect(models.articles.db).toBe(db);
		expect(models.articles.context.db).toBe(db);
		expect(typeof models.articles.context.get).toBe("function");
		expect(imports.articles).toBe(0);
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
					seen.push(ctx.get(Greeting) ?? "missing");
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
