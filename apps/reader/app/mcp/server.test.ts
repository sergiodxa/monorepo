/**
 * Drives the agent surface the way a client does: whole requests through the app's own
 * router, against a real reader's object behind the `USER` binding.
 *
 * What is asserted here is everything between the wire and the store — that a credential
 * decides which object answers and which tools exist, that a page is bounded and paged by
 * a reference a model cannot build, that a freshness check happens on a first page and on
 * no other, and that nothing a publisher wrote reaches the log.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurableObjectStateMock } from "@sdxc/cloudflare-mocks";

import {
	createD1Database,
	createDurableObjectNamespace,
	createDurableObjectState,
	createKVNamespace,
} from "@sdxc/cloudflare-mocks";
import { LATEST_PROTOCOL_VERSION, MetaKey } from "@sdxc/mcp";
import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import catalogSql from "~/database/catalog-migrations/0001-feeds.sql?raw";
import { TOKEN_LIFETIME_MS } from "~/database/schema";
import { UserDO } from "~/database/user-do";

/** The bindings every module reads off `cloudflare:workers`, swapped per test. */
let bindings = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("cloudflare:workers", async (importOriginal) => {
	let original = await importOriginal<typeof import("cloudflare:workers")>();

	return {
		...original,
		env: new Proxy(
			{},
			{
				get(_target, property: string) {
					if (property in bindings.current) return bindings.current[property];
					return `test-${property}`;
				},
			},
		),
	};
});

/** The reader every request in this file is answered for. */
const READER = "sub-agent-server";

/** A second reader, so isolation is asserted against somebody who exists. */
const OTHER = "sub-agent-other";

const ENDPOINT = "https://reader.sergiodxa.com/mcp";

/** The five tools a read-scoped credential must never learn about. */
const WRITING_TOOLS = ["mark_read", "mark_feed_read", "save_post", "follow_feed", "unfollow_feed"];

/** Every reader's object this run has built, so one name is one object. */
let readers = new Map<string, { state: DurableObjectStateMock; user: UserDO }>();

/** Key prefixes a head read uses, counted so a freshness check is visible to a test. */
let headReads: string[][] = [];

/** What one tool or resource call answered, in the fields these tests read. */
interface Body {
	result?: {
		tools?: Array<{ name: string; inputSchema?: unknown }>;
		resources?: Array<{ uri: string; title?: string }>;
		resourceTemplates?: Array<{ uriTemplate: string }>;
		content?: Array<{ text?: string }>;
		contents?: Array<{ text?: string }>;
		isError?: boolean;
	};
	error?: { code?: number; message?: string };
}

/** Everything the request's own record carried, for the assertions about the log. */
let records: unknown[] = [];

beforeEach(async () => {
	readers.clear();
	headReads.length = 0;
	records.length = 0;

	let catalog = createD1Database();
	await catalog.exec(catalogSql);

	bindings.current = {
		KV: countingHeads(createKVNamespace()),
		PLATFORM_DB: catalog,
		FEED: createDurableObjectNamespace(() => ({})),
		/** Absent rather than a string, so the burst limiter passes the request through. */
		MCP_RATE_LIMITER: undefined,
		USER: createDurableObjectNamespace<UserDO>((name) => readerStub(name)),
	};

	vi.spyOn(console, "log").mockImplementation((record: unknown) => void records.push(record));
	vi.spyOn(console, "info").mockImplementation((record: unknown) => void records.push(record));
	vi.spyOn(console, "warn").mockImplementation((record: unknown) => void records.push(record));
});

afterEach(() => vi.restoreAllMocks());

/** Wraps a namespace so a bulk read of feed heads is visible to the freshness assertions. */
function countingHeads(kv: KVNamespace): KVNamespace {
	return new Proxy(kv, {
		get(target, property) {
			if (property !== "get") return Reflect.get(target, property) as unknown;

			return (keys: string | string[], ...rest: unknown[]) => {
				if (Array.isArray(keys)) headReads.push(keys);
				return (target.get as (...args: unknown[]) => unknown)(keys, ...rest);
			};
		},
	});
}

/**
 * The RPC methods this surface reaches, named because a stub is an object rather than a
 * class: nothing copies a prototype across the binding.
 */
const USER_METHODS = [
	"authorizeAgent",
	"listAgentTokens",
	"createAgentToken",
	"revokeAgentToken",
	"openReader",
	"synchronize",
	"readingQueue",
	"feedTimeline",
	"savedQueue",
	"listFeeds",
	"getFeed",
	"followFeed",
	"unfollowFeed",
	"markFeedRead",
	"markRead",
	"saveItem",
	"openPost",
] as const;

/** The reader's object one name addresses, built on first use the way the platform builds one. */
function reader(name: string): { state: DurableObjectStateMock; user: UserDO } {
	let existing = readers.get(name);
	if (existing !== undefined) return existing;

	let state = createDurableObjectState({ name });
	let built = { state, user: new UserDO(state, env) };
	readers.set(name, built);

	return built;
}

/** The reader's object, with the boot the platform runs before a first call awaited. */
async function booted(name: string): Promise<{ state: DurableObjectStateMock; user: UserDO }> {
	let built = reader(name);
	await built.state.blockConcurrencyWhile(async () => undefined);

	return built;
}

/** What the `USER` binding hands back: the shipped class behind a name, method by method. */
function readerStub(name: string): Record<string, unknown> {
	return Object.fromEntries(
		USER_METHODS.map((method) => [
			method,
			async (...args: unknown[]) => {
				let { user } = await booted(name);
				let called = user[method] as (...rest: unknown[]) => unknown;

				return await called.call(user, ...args);
			},
		]),
	);
}

/** The router under test, built the way the worker builds it. */
async function app() {
	let { default: application } = await import("~/bootstrap/app");

	return application({ kv: env.KV, cookieSecret: "test-cookie-secret", secure: false });
}

/** Mints a token for one reader and writes the row describing it. */
async function tokenFor(
	name: string,
	options: { scope?: string; tier?: string } = {},
): Promise<string> {
	let { state } = await booted(name);

	state.storage.sql.exec(
		`INSERT INTO settings (id, subject, tier, created_at, updated_at)
		 VALUES (1, ?, ?, 0, 0)
		 ON CONFLICT (id) DO UPDATE SET tier = excluded.tier`,
		name,
		options.tier ?? "paid",
	);

	let { mintAgentToken } = await import("~/app/mcp/token");
	let minted = await mintAgentToken(name);

	state.storage.sql.exec(
		`INSERT INTO tokens (id, name, scope, hash, created_at, last_used_at, expires_at, revoked_at)
		 VALUES (?, 'Laptop', ?, ?, 0, NULL, ?, NULL)`,
		minted.tokenId,
		options.scope ?? "write",
		minted.hash,
		Date.now() + TOKEN_LIFETIME_MS,
	);

	return minted.token;
}

/** One MCP request, carrying the headers and `_meta` this revision requires. */
function mcpRequest(method: string, params: Record<string, unknown> = {}, token?: string): Request {
	let headers: Record<string, string> = {
		"Content-Type": "application/json",
		"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
		"Mcp-Method": method,
	};

	if (token !== undefined) headers.Authorization = `Bearer ${token}`;
	if (method === "tools/call" && typeof params.name === "string") headers["Mcp-Name"] = params.name;
	if (method === "resources/read" && typeof params.uri === "string") {
		headers["Mcp-Name"] = params.uri;
	}

	return new Request(ENDPOINT, {
		method: "POST",
		headers,
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method,
			params: {
				...params,
				_meta: {
					[MetaKey.ProtocolVersion]: LATEST_PROTOCOL_VERSION,
					[MetaKey.ClientCapabilities]: {},
				},
			},
		}),
	});
}

/** Sends one request through the whole router and reads back what it answered. */
async function send(
	method: string,
	params: Record<string, unknown> = {},
	token?: string,
): Promise<{ status: number; headers: Headers; body: Body }> {
	let response = await (await app()).fetch(mcpRequest(method, params, token));
	let text = await response.text();

	return {
		status: response.status,
		headers: response.headers,
		body: text === "" ? {} : (JSON.parse(text) as Body),
	};
}

/** Calls one tool and hands back the JSON it answered with. */
async function call(
	tool: string,
	args: Record<string, unknown>,
	token: string,
): Promise<{ body: Body; answer: Record<string, unknown> }> {
	let { body } = await send("tools/call", { name: tool, arguments: args }, token);
	let text = body.result?.content?.[0]?.text ?? "{}";

	let answer: Record<string, unknown> = {};
	try {
		answer = JSON.parse(text) as Record<string, unknown>;
	} catch {
		answer = { text };
	}

	return { body, answer };
}

/** A subscription written straight into a reader's storage. */
async function seedFeed(name: string, id: string, title = id): Promise<void> {
	(await booted(name)).state.storage.sql.exec(
		`INSERT INTO feeds (id, feed_id, feed_url, title, cursor, created_at, updated_at)
		 VALUES (?, ?, ?, ?, 0, 0, 0)`,
		id,
		`canonical-${id}`,
		`https://${id}.example.com/feed.xml`,
		title,
	);
}

/** Posts of one subscription, written straight into storage, newest last. */
async function seedItems(
	name: string,
	feedId: string,
	count: number,
	saved = false,
	prefix = "item",
): Promise<string[]> {
	let ids: string[] = [];
	let { state } = await booted(name);

	for (let index = 0; index < count; index++) {
		let id = `${feedId}-${prefix}-${index}`;

		state.storage.sql.exec(
			`INSERT INTO feed_items
				(id, feed_id, guid, title, url, summary, author, published_at, read_at, saved_at,
				 created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, 0, 0)`,
			id,
			feedId,
			id,
			`Post ${index}`,
			`https://example.com/${id}`,
			`About post ${index}`,
			1_800_000_000_000 + index,
			saved ? 1 : null,
		);

		ids.push(id);
	}

	return ids;
}

describe("the credential", () => {
	test("refuses a request carrying no token, and names the scheme", async () => {
		let { status, headers } = await send("tools/list");

		expect(status).toBe(401);
		expect(headers.get("WWW-Authenticate")).toBe("Bearer");
	});

	/** A forged value is answered by a signature verify, so no reader's object is opened. */
	test("refuses a token this deployment did not sign, waking no object", async () => {
		let { status } = await send("tools/list", {}, "rdr_forged.signature");

		expect(status).toBe(401);
		expect(readers.size).toBe(0);
	});

	test("answers from the object its subject names, and from no other", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine", "Mine");
		await seedFeed(OTHER, "theirs", "Theirs");

		let { answer } = await call("list_feeds", {}, token);

		expect((answer.feeds as Array<{ title: string }>).map((feed) => feed.title)).toEqual(["Mine"]);
	});

	test("refuses an account whose plan does not answer an agent, and says where to fix it", async () => {
		let token = await tokenFor(READER, { tier: "free" });

		let response = await (await app()).fetch(mcpRequest("tools/list", {}, token));
		let refusal = (await response.json()) as { error_description?: string };

		expect(response.status).toBe(403);
		expect(refusal.error_description).toContain("/settings");
	});

	/** A paid caller sees a surface, so the refusal above is a paywall rather than a broken server. */
	test("lists tools for an account that is entitled", async () => {
		let token = await tokenFor(READER);
		let { body } = await send("tools/list", {}, token);

		expect(body.result?.tools?.length).toBeGreaterThan(0);
	});
});

describe("scope", () => {
	test("lists no writing tool for a read-scoped credential", async () => {
		let token = await tokenFor(READER, { scope: "read" });
		let { body } = await send("tools/list", {}, token);

		let names = body.result?.tools?.map((each) => each.name) ?? [];

		for (let writing of WRITING_TOOLS) expect(names).not.toContain(writing);
		expect(names).toContain("read_timeline");
	});

	test("reports a writing tool as unknown when a read-scoped credential calls one", async () => {
		let token = await tokenFor(READER, { scope: "read" });
		await seedFeed(READER, "mine");
		let [item = ""] = await seedItems(READER, "mine", 1);

		let { body } = await call("mark_read", { itemId: item }, token);

		expect(body.error?.code).toBe(-32602);
		expect(body.result).toBeUndefined();
	});

	test("lists every writing tool for a write-scoped credential", async () => {
		let token = await tokenFor(READER, { scope: "write" });
		let { body } = await send("tools/list", {}, token);

		let names = body.result?.tools?.map((each) => each.name) ?? [];

		for (let writing of WRITING_TOOLS) expect(names).toContain(writing);
	});
});

describe("reading", () => {
	test("checks every subscription's head on a first page", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine");
		await seedItems(READER, "mine", 3);

		await call("read_timeline", {}, token);

		expect(headReads.length).toBeGreaterThan(0);
	});

	test("checks nothing when a page reference is passed back", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine");
		await seedItems(READER, "mine", 4);

		let first = await call("read_timeline", { limit: 2 }, token);
		headReads.length = 0;

		await call("read_timeline", { limit: 2, cursor: first.answer.nextCursor }, token);

		expect(headReads).toEqual([]);
	});

	test("pages forward from the reference the previous call returned", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine");
		await seedItems(READER, "mine", 4);

		let first = await call("read_timeline", { limit: 2 }, token);
		let second = await call("read_timeline", { limit: 2, cursor: first.answer.nextCursor }, token);

		let ids = (page: Record<string, unknown>) =>
			(page.posts as Array<{ id: string }>).map((post) => post.id);

		expect(ids(first.answer)).toHaveLength(2);
		expect(ids(second.answer)).toHaveLength(2);
		expect(ids(second.answer)).not.toEqual(ids(first.answer));
	});

	/** A model handed two references picks the wrong one, so only the forward one crosses. */
	test("never hands back a backwards reference", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine");
		await seedItems(READER, "mine", 4);

		let first = await call("read_timeline", { limit: 2 }, token);
		let second = await call("read_timeline", { limit: 2, cursor: first.answer.nextCursor }, token);

		expect(Object.keys(second.answer)).toEqual(["posts", "nextCursor"]);
	});

	test("answers an unreadable page reference with something the model can act on", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine");
		await seedItems(READER, "mine", 3);

		let { body } = await call("read_timeline", { cursor: "not-a-cursor" }, token);

		expect(body.result?.isError).toBe(true);
		expect(body.result?.content?.[0]?.text).toMatch(/expired/i);
	});

	test("refuses a page larger than the ceiling before any handler runs", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine");
		await seedItems(READER, "mine", 3);

		let { body } = await call("read_timeline", { limit: 51 }, token);

		expect(body.error?.code).toBe(-32602);
		expect(body.result).toBeUndefined();
	});

	test("finds posts by the words in them", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine");
		await seedItems(READER, "mine", 3);

		let { answer } = await call("search_timeline", { query: "post 1" }, token);

		expect(answer.posts).toHaveLength(1);
	});
});

describe("writing", () => {
	test("leaves a post exactly where one call left it, however many times it is called", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine");
		let [item = ""] = await seedItems(READER, "mine", 1);

		let first = await call("mark_read", { itemId: item }, token);
		let again = await call("mark_read", { itemId: item }, token);

		expect(first.answer).toEqual({ read: true });
		expect(again.answer).toEqual({ read: true });

		let unread = await call("mark_read", { itemId: item, read: false }, token);
		expect(unread.answer).toEqual({ read: false });
	});

	test("keeps a post, and keeps it once however many times it is asked", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine");
		let [item = ""] = await seedItems(READER, "mine", 1);

		expect((await call("save_post", { itemId: item }, token)).answer).toEqual({ saved: true });
		expect((await call("save_post", { itemId: item }, token)).answer).toEqual({ saved: true });

		let { answer } = await call("read_saved", {}, token);
		expect(answer.posts).toHaveLength(1);
	});

	/** Unfollowing takes the feed's posts and leaves the ones the reader asked to keep. */
	test("takes a feed's posts and keeps its saved ones", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine");
		await seedItems(READER, "mine", 2);
		await seedItems(READER, "mine", 1, true, "kept");

		await call("unfollow_feed", { feedId: "mine" }, token);

		let saved = await call("read_saved", {}, token);
		expect(saved.answer.posts).toHaveLength(1);

		let feeds = await call("list_feeds", {}, token);
		expect(feeds.answer.feeds).toHaveLength(0);
	});

	test("empties one feed's queue and says how many that was", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine");
		await seedItems(READER, "mine", 3);

		expect((await call("mark_feed_read", { feedId: "mine" }, token)).answer).toEqual({ marked: 3 });
	});
});

describe("resources", () => {
	test("enumerates this reader's own feeds", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine", "Mine");
		await seedFeed(OTHER, "theirs", "Theirs");

		let { body } = await send("resources/list", {}, token);

		expect(body.result?.resources?.map((each) => each.uri)).toEqual([
			"reader://feeds/mine",
			"reader://saved",
		]);
	});

	/** Tens of thousands of posts is what a template exists for, so none is enumerated. */
	test("enumerates no post, and publishes one as a template", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine");
		await seedItems(READER, "mine", 3);

		let listed = await send("resources/list", {}, token);
		let templates = await send("resources/templates/list", {}, token);

		for (let each of listed.body.result?.resources ?? []) {
			expect(each.uri).not.toContain("reader://posts/");
		}

		expect(templates.body.result?.resourceTemplates?.map((each) => each.uriTemplate)).toContain(
			"reader://posts/{itemId}",
		);
	});

	test("reads one post back through its own URI", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine");
		let [item = ""] = await seedItems(READER, "mine", 1);

		let { body } = await send("resources/read", { uri: `reader://posts/${item}` }, token);
		let read = JSON.parse(body.result?.contents?.[0]?.text ?? "{}") as { id?: string };

		expect(read.id).toBe(item);
	});

	test("answers not-found for a post this reader does not hold", async () => {
		let token = await tokenFor(READER);
		await seedFeed(OTHER, "theirs");
		let [item = ""] = await seedItems(OTHER, "theirs", 1);

		let { body } = await send("resources/read", { uri: `reader://posts/${item}` }, token);

		expect(body.error?.code).toBe(-32602);
	});

	test("hands the shelf over whole, as one concrete URI", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine");
		await seedItems(READER, "mine", 2, true);

		let { body } = await send("resources/read", { uri: "reader://saved" }, token);
		let read = JSON.parse(body.result?.contents?.[0]?.text ?? "{}") as { posts?: unknown[] };

		expect(read.posts).toHaveLength(2);
	});
});

describe("the surface itself", () => {
	/**
	 * Cross-reader access is absent from the shape of the storage rather than prevented by a
	 * check, and this server adds no argument that would reintroduce it.
	 */
	test("declares no argument naming a reader", async () => {
		let token = await tokenFor(READER);

		let tools = await send("tools/list", {}, token);
		let templates = await send("resources/templates/list", {}, token);

		let named = JSON.stringify([
			tools.body.result?.tools?.map((each) => each.inputSchema),
			templates.body.result?.resourceTemplates,
		]);

		for (let forbidden of ["subject", "userId", "reader", "account", "sub"]) {
			expect(named.toLowerCase()).not.toContain(`"${forbidden}"`);
		}
	});

	test("tells the model a tool failed without telling it what broke", async () => {
		let token = await tokenFor(READER);
		let { user } = await booted(READER);

		vi.spyOn(user, "listFeeds").mockRejectedValue(
			new Error("D1_ERROR: no such column secret_internal_field"),
		);

		let { body } = await call("list_feeds", {}, token);

		expect(body.result?.isError).toBe(true);
		expect(body.result?.content?.[0]?.text).not.toContain("secret_internal_field");
	});
});

describe("what is recorded", () => {
	test("carries a token id and counts, and neither a token value nor a post's words", async () => {
		let token = await tokenFor(READER);
		await seedFeed(READER, "mine");
		await seedItems(READER, "mine", 2);

		await call("read_timeline", {}, token);

		let written = JSON.stringify(records);

		expect(written).toContain("mcp.authorized");
		expect(written).toContain("mcp.tool");
		expect(written).not.toContain(token);
		expect(written).not.toContain("Post 0");
		expect(written).not.toContain("example.com/mine-item-0");
	});

	test("records a refusal by its reason alone", async () => {
		await send("tools/list");

		let written = JSON.stringify(records);

		expect(written).toContain("mcp.refused");
		expect(written).toContain("no-token");
	});
});
