/**
 * Tests for the transport, dispatch, and middleware chain.
 *
 * Every case goes through a real `Request`, because the things most likely to break a
 * client live at that boundary: the headers this revision made mandatory, the status a
 * refusal carries, and which of the two error channels a failure comes back on. The last
 * group runs the handler inside an actual `remix/router`, which is the claim the whole
 * design rests on — that an app's own middleware is the MCP surface's middleware too.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createContextKey, RequestContext, createRouter } from "remix/router";
import { route } from "remix/routes";
import { describe, expect, expectTypeOf, test, vi } from "vitest";

import type { CallToolResult, ToolMiddleware } from "./tools";
import type { InputOf } from "./tools";

import { ForbiddenError, ToolError } from "./errors";
import { createHandler } from "./handler";
import { ErrorCode } from "./jsonrpc";
import { LATEST_PROTOCOL_VERSION, MetaKey } from "./protocol";
import { tool, tools } from "./tools";

/** Stands in for whatever an app's middleware provides. */
class Database {
	constructor(readonly label: string) {}
}

/** The caller's granted scopes, as an app's auth middleware would publish them. */
const Scopes = createContextKey<readonly string[]>();

const toolset = tools({
	listPosts: tool("list_posts", {
		description: "Lists published posts.",
		input: {
			type: "object",
			properties: { limit: { type: "integer", minimum: 1, default: 5 } },
		},
		annotations: { readOnlyHint: true },
	}),
	posts: tools({
		get: tool("get_post", {
			description: "Reads one post.",
			input: {
				type: "object",
				properties: { slug: { type: "string" } },
				required: ["slug"],
			},
		}),
		create: tool("create_post", {
			description: "Creates a post.",
			input: {
				type: "object",
				properties: { title: { type: "string" } },
				required: ["title"],
			},
		}),
	}),
	structured: tool("structured", {
		description: "Answers with a declared shape.",
		input: { type: "object", properties: {} },
		output: { type: "object", properties: { count: { type: "integer" } } },
	}),
	broken: tool("broken", {
		description: "Fails unexpectedly.",
		input: { type: "object", properties: {} },
	}),
});

/** Records the order middleware ran in, for the chain-ordering case. */
let trace: string[] = [];

/** Middleware that appends its label before and after the rest of the chain. */
function mark(label: string): ToolMiddleware {
	return async (_ctx, next) => {
		trace.push(`${label}:in`);
		let result = await next();
		trace.push(`${label}:out`);
		return result;
	};
}

/** Builds a handler over `toolset`, with options a case may override. */
function build(
	options: Parameters<typeof createHandler>[0] extends infer O ? Partial<O> : never = {},
) {
	let mcp = createHandler({
		name: "test-server",
		version: "1.0.0",
		instructions: "Read the blog.",
		toolMiddleware: [mark("handler")],
		...options,
	});

	mcp.tools.map(toolset.listPosts, (ctx) => {
		expectTypeOf(ctx.input.limit).toEqualTypeOf<number>();
		return { posts: Array.from({ length: ctx.input.limit }, (_, i) => `post-${i}`) };
	});

	mcp.tools.map(toolset.posts, {
		middleware: [mark("group")],
		actions: {
			get: {
				middleware: [mark("action")],
				handler(ctx) {
					expectTypeOf(ctx.input.slug).toEqualTypeOf<string>();
					if (ctx.input.slug === "missing") throw new ToolError("That post is still a draft.");
					return { slug: ctx.input.slug, db: ctx.get(Database)?.label };
				},
			},
			create: {
				available: (ctx) => (ctx.get(Scopes) ?? []).includes("posts:write"),
				middleware: [requireScope("posts:write")],
				handler: (ctx) => ({ created: ctx.input.title }),
			},
		},
	});

	mcp.tools.map(toolset.structured, () => ({ count: 2 }));
	mcp.tools.map(toolset.broken, () => {
		throw new Error("D1_ERROR: no such column: secret_internal_field");
	});

	return mcp;
}

/** The backstop a stale tool list would hit. Erased input, so it fits any tool. */
function requireScope(scope: string): ToolMiddleware {
	return (ctx, next) => {
		if (!(ctx.get(Scopes) ?? []).includes(scope)) {
			throw new ForbiddenError(`This caller lacks the ${scope} scope`);
		}
		return next();
	};
}

/** Every field these tests read off a response body, across all three methods. */
interface Body {
	result?: {
		resultType?: string;
		supportedVersions?: string[];
		capabilities?: Record<string, unknown>;
		instructions?: string;
		ttlMs?: number;
		cacheScope?: string;
		tools?: Array<{ name: string }>;
		content?: Array<{ type: string; text: string }>;
		structuredContent?: unknown;
		isError?: boolean;
		_meta?: Record<string, unknown>;
	};
	error?: { code?: number; message?: string; data?: { supported?: string[]; issues?: string[] } };
}

/** Builds a POST carrying the headers and `_meta` this revision requires. */
function send(
	method: string,
	params: Record<string, unknown> = {},
	overrides: { headers?: Record<string, string | null>; version?: string } = {},
): Request {
	let version = overrides.version ?? LATEST_PROTOCOL_VERSION;
	let headers: Record<string, string> = {
		"Content-Type": "application/json",
		"MCP-Protocol-Version": version,
		"Mcp-Method": method,
	};
	if (method === "tools/call" && typeof params.name === "string") {
		headers["Mcp-Name"] = params.name;
	}
	for (let [key, value] of Object.entries(overrides.headers ?? {})) {
		if (value === null) delete headers[key];
		else headers[key] = value;
	}

	return new Request("https://example.com/mcp", {
		method: "POST",
		headers,
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: 1,
			method,
			params: {
				...params,
				_meta: {
					[MetaKey.ProtocolVersion]: version,
					[MetaKey.ClientInfo]: { name: "TestClient", version: "1.0.0" },
					[MetaKey.ClientCapabilities]: {},
				},
			},
		}),
	});
}

/** Sends a request through a handler and reads the body. */
async function call(
	request: Request,
	options: { scopes?: readonly string[]; db?: Database; mcp?: ReturnType<typeof build> } = {},
): Promise<{ status: number; body: Body }> {
	let ctx = new RequestContext(request);
	if (options.scopes) ctx.set(Scopes, options.scopes);
	if (options.db) ctx.set(Database, options.db);

	let response = await (options.mcp ?? build()).fetch(ctx);
	return { status: response.status, body: (await response.json()) as Body };
}

/** A `tools/call` params object. */
function callParams(name: string, args?: unknown) {
	return { name, arguments: args };
}

/** The text of a result's first content block. */
function firstText(body: Body): string {
	return body.result?.content?.[0]?.text ?? "";
}

describe("server/discover", () => {
	test("advertises the versions, capabilities and identity a client probes for", async () => {
		let { status, body } = await call(send("server/discover"));

		expect(status).toBe(200);
		expect(body.result?.resultType).toBe("complete");
		expect(body.result?.supportedVersions).toEqual([LATEST_PROTOCOL_VERSION]);
		expect(body.result?.capabilities).toEqual({ tools: { listChanged: false } });
		expect(body.result?.instructions).toBe("Read the blog.");
		expect(body.result?._meta?.[MetaKey.ServerInfo]).toEqual({
			name: "test-server",
			version: "1.0.0",
		});
	});
});

describe("tools/list", () => {
	test("lists only the tools this caller may use, in declaration order", async () => {
		let { body } = await call(send("tools/list"));

		expect(body.result?.tools?.map((each) => each.name)).toEqual([
			"list_posts",
			"get_post",
			"structured",
			"broken",
		]);
	});

	test("includes a conditional tool once the context permits it", async () => {
		let { body } = await call(send("tools/list"), { scopes: ["posts:write"] });

		expect(body.result?.tools?.map((each) => each.name)).toContain("create_post");
	});

	/** A list that varies by credential must never be held by a shared intermediary. */
	test("marks the list private when any tool is conditional", async () => {
		let { body } = await call(send("tools/list"));

		expect(body.result?.cacheScope).toBe("private");
		expect(body.result?.ttlMs).toBe(60_000);
	});

	test("marks the list public when no tool is conditional", async () => {
		let mcp = createHandler({ name: "public", version: "1.0.0" });
		mcp.tools.map(toolset.listPosts, () => ({ posts: [] }));

		let response = await mcp.fetch(send("tools/list"));
		let body = (await response.json()) as Body;

		expect(body.result?.cacheScope).toBe("public");
	});
});

describe("tools/call", () => {
	test("runs a tool and serializes what it returned", async () => {
		let { body } = await call(send("tools/call", callParams("list_posts", { limit: 2 })));

		expect(body.result?.resultType).toBe("complete");
		expect(JSON.parse(firstText(body))).toEqual({ posts: ["post-0", "post-1"] });
		expect(body.result?.isError).toBeUndefined();
	});

	test("applies a default the caller omitted", async () => {
		let { body } = await call(send("tools/call", callParams("list_posts")));

		expect((JSON.parse(firstText(body)) as { posts: string[] }).posts).toHaveLength(5);
	});

	test("reads a value the surrounding context provided", async () => {
		let { body } = await call(send("tools/call", callParams("get_post", { slug: "remix" })), {
			db: new Database("blog-db"),
		});

		expect(JSON.parse(firstText(body))).toEqual({ slug: "remix", db: "blog-db" });
	});

	test("attaches structuredContent only when an output schema was declared", async () => {
		let withSchema = await call(send("tools/call", callParams("structured")));
		let withoutSchema = await call(send("tools/call", callParams("list_posts")));

		expect(withSchema.body.result?.structuredContent).toEqual({ count: 2 });
		expect(withoutSchema.body.result).not.toHaveProperty("structuredContent");
	});

	test("reports invalid arguments as a protocol error carrying every issue", async () => {
		let { status, body } = await call(send("tools/call", callParams("list_posts", { limit: 0 })));

		expect(status).toBe(200);
		expect(body.error?.code).toBe(ErrorCode.InvalidParams);
		expect(body.error?.data?.issues).toEqual(["limit: expected 1 or more"]);
	});

	test("reports a tool the caller may not use as unknown, not as forbidden", async () => {
		let { body } = await call(send("tools/call", callParams("create_post", { title: "x" })));

		expect(body.error?.code).toBe(ErrorCode.InvalidParams);
		expect(body.error?.message).toBe("Unknown tool: create_post");
	});

	test("runs a conditional tool once the caller has the scope", async () => {
		let { body } = await call(send("tools/call", callParams("create_post", { title: "x" })), {
			scopes: ["posts:write"],
		});

		expect(JSON.parse(firstText(body))).toEqual({ created: "x" });
	});

	test("reports a ToolError as a readable result so the model can react", async () => {
		let { body } = await call(send("tools/call", callParams("get_post", { slug: "missing" })));

		expect(body.result?.isError).toBe(true);
		expect(firstText(body)).toBe("That post is still a draft.");
	});

	test("hides an unexpected error's message and reports it to onError instead", async () => {
		let onError = vi.fn();
		let { body } = await call(send("tools/call", callParams("broken")), {
			mcp: build({ onError }),
		});

		expect(body.result?.isError).toBe(true);
		expect(firstText(body)).toBe("The broken tool failed unexpectedly.");
		expect(firstText(body)).not.toContain("secret_internal_field");
		expect(onError).toHaveBeenCalledWith(expect.any(Error), {
			method: "tools/call",
			tool: "broken",
		});
	});
});

describe("middleware", () => {
	test("runs handler, then group, then action middleware, and unwinds in reverse", async () => {
		trace = [];
		await call(send("tools/call", callParams("get_post", { slug: "remix" })));

		expect(trace).toEqual([
			"handler:in",
			"group:in",
			"action:in",
			"action:out",
			"group:out",
			"handler:out",
		]);
	});

	test("does not run tool middleware for tools/list", async () => {
		trace = [];
		await call(send("tools/list"));

		expect(trace).toEqual([]);
	});

	test("sees the result the tool produced, which is what metering needs", async () => {
		let seen: CallToolResult | undefined;
		let mcp = createHandler({
			name: "metered",
			version: "1.0.0",
			toolMiddleware: [
				async (_ctx, next) => {
					seen = await next();
					return seen;
				},
			],
		});
		mcp.tools.map(toolset.listPosts, () => ({ posts: ["a"] }));

		await mcp.fetch(send("tools/call", callParams("list_posts", { limit: 1 })));

		expect(seen?.isError).toBeUndefined();
		expect(seen?.content[0]?.text).toContain("posts");
	});

	test("can be bound to one tool's input type", async () => {
		let slug: string | undefined;
		let capture: ToolMiddleware<InputOf<typeof toolset.posts.get>> = (ctx, next) => {
			slug = ctx.input.slug;
			return next();
		};

		let mcp = createHandler({ name: "typed", version: "1.0.0" });
		mcp.tools.map(toolset.posts, {
			actions: {
				get: { middleware: [capture], handler: () => "ok" },
				create: () => "ok",
			},
		});

		await mcp.fetch(send("tools/call", callParams("get_post", { slug: "remix" })));

		expect(slug).toBe("remix");
	});

	test("refuses a middleware that calls next() twice", async () => {
		let mcp = createHandler({
			name: "double",
			version: "1.0.0",
			onError: () => {},
			toolMiddleware: [
				async (_ctx, next) => {
					await next();
					return next();
				},
			],
		});
		mcp.tools.map(toolset.listPosts, () => ({ posts: [] }));

		let response = await mcp.fetch(send("tools/call", callParams("list_posts")));
		let body = (await response.json()) as Body;

		expect(body.result?.isError).toBe(true);
	});

	/**
	 * Reached only by a client working from a stale tool list, since `available` already
	 * hid the tool from this caller.
	 */
	test("reports a ForbiddenError from middleware as a protocol error", async () => {
		let mcp = createHandler({ name: "guarded", version: "1.0.0" });
		mcp.tools.map(toolset.posts, {
			actions: {
				get: { middleware: [requireScope("posts:read")], handler: () => "ok" },
				create: () => "ok",
			},
		});

		let response = await mcp.fetch(send("tools/call", callParams("get_post", { slug: "x" })));
		let body = (await response.json()) as Body;

		expect(body.error?.code).toBe(ErrorCode.InvalidParams);
		expect(body.error?.message).toBe("This caller lacks the posts:read scope");
	});
});

describe("transport", () => {
	test("refuses GET with 405, since this revision has no stream to open", async () => {
		let response = await build().fetch(new Request("https://example.com/mcp"));

		expect(response.status).toBe(405);
		expect(response.headers.get("Allow")).toBe("POST");
	});

	test("refuses DELETE with 405, since there is no session to terminate", async () => {
		let response = await build().fetch(
			new Request("https://example.com/mcp", { method: "DELETE" }),
		);

		expect(response.status).toBe(405);
	});

	test("accepts a bare Request, building its own context", async () => {
		let response = await build().fetch(send("tools/list"));

		expect(response.status).toBe(200);
	});

	test("refuses a body sent without a JSON content type", async () => {
		let response = await build().fetch(
			new Request("https://example.com/mcp", {
				method: "POST",
				headers: { "Content-Type": "text/plain" },
				body: "{}",
			}),
		);

		expect(response.status).toBe(415);
	});

	test("accepts a JSON content type carrying a charset", async () => {
		let request = send(
			"tools/list",
			{},
			{
				headers: { "Content-Type": "application/json; charset=utf-8" },
			},
		);

		expect((await build().fetch(request)).status).toBe(200);
	});

	test("refuses a body that is not JSON", async () => {
		let response = await build().fetch(
			new Request("https://example.com/mcp", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "{not json",
			}),
		);

		expect(response.status).toBe(400);
		expect(((await response.json()) as Body).error?.code).toBe(ErrorCode.ParseError);
	});

	test("refuses a batch, which this revision removed", async () => {
		let response = await build().fetch(
			new Request("https://example.com/mcp", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify([{ jsonrpc: "2.0", id: 1, method: "tools/list" }]),
			}),
		);

		expect(((await response.json()) as Body).error?.code).toBe(ErrorCode.InvalidRequest);
	});

	test("acknowledges a notification with 202 and no body", async () => {
		let response = await build().fetch(
			new Request("https://example.com/mcp", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/whatever" }),
			}),
		);

		expect(response.status).toBe(202);
		expect(await response.text()).toBe("");
	});

	/**
	 * The status is what lets a client tell a modern server missing a method from a
	 * legacy server missing the endpoint.
	 */
	test("answers an unknown method with 404, not 200", async () => {
		let { status, body } = await call(send("prompts/list"));

		expect(status).toBe(404);
		expect(body.error?.code).toBe(ErrorCode.MethodNotFound);
	});

	test("refuses a request with no MCP-Protocol-Version header", async () => {
		let { status, body } = await call(
			send("tools/list", {}, { headers: { "MCP-Protocol-Version": null } }),
		);

		expect(status).toBe(400);
		expect(body.error?.code).toBe(ErrorCode.HeaderMismatch);
	});

	test("refuses a Mcp-Method header that disagrees with the body", async () => {
		let { status, body } = await call(
			send("tools/list", {}, { headers: { "Mcp-Method": "tools/call" } }),
		);

		expect(status).toBe(400);
		expect(body.error?.code).toBe(ErrorCode.HeaderMismatch);
	});

	test("refuses a Mcp-Name header that disagrees with the body", async () => {
		let { status, body } = await call(
			send("tools/call", callParams("list_posts"), { headers: { "Mcp-Name": "get_post" } }),
		);

		expect(status).toBe(400);
		expect(body.error?.code).toBe(ErrorCode.HeaderMismatch);
	});

	test("decodes a Base64 sentinel Mcp-Name before comparing it", async () => {
		let encoded = `=?base64?${btoa("list_posts")}?=`;
		let { status } = await call(
			send("tools/call", callParams("list_posts"), { headers: { "Mcp-Name": encoded } }),
		);

		expect(status).toBe(200);
	});

	test("refuses a request whose _meta omits the protocol version", async () => {
		let response = await build().fetch(
			new Request("https://example.com/mcp", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
					"Mcp-Method": "tools/list",
				},
				body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
			}),
		);

		expect(response.status).toBe(400);
		expect(((await response.json()) as Body).error?.code).toBe(ErrorCode.InvalidParams);
	});

	test("refuses a header version that disagrees with the _meta version", async () => {
		let request = send(
			"tools/list",
			{},
			{
				headers: { "MCP-Protocol-Version": "2025-06-18" },
			},
		);
		let { status, body } = await call(request);

		expect(status).toBe(400);
		expect(body.error?.code).toBe(ErrorCode.HeaderMismatch);
	});

	test("refuses an unsupported version, naming the ones it does support", async () => {
		let { status, body } = await call(send("tools/list", {}, { version: "2025-06-18" }));

		expect(status).toBe(400);
		expect(body.error?.code).toBe(ErrorCode.UnsupportedProtocolVersion);
		expect(body.error?.data?.supported).toEqual([LATEST_PROTOCOL_VERSION]);
	});

	test("refuses an Origin the application did not allow", async () => {
		let mcp = createHandler({
			name: "guarded",
			version: "1.0.0",
			allowedOrigins: ["https://app.example.com"],
		});

		let request = send("tools/list", {}, { headers: { Origin: "https://evil.example.com" } });

		expect((await mcp.fetch(request)).status).toBe(403);
	});
});

describe("inside a remix router", () => {
	test("tools read what the router's own middleware provided", async () => {
		let routes = route({ mcp: { method: "POST", pattern: "/mcp" } });
		let mcp = createHandler({ name: "mounted", version: "1.0.0" });
		mcp.tools.map(toolset.posts, {
			actions: {
				get: (ctx) => ({ db: ctx.get(Database)?.label, scopes: ctx.get(Scopes) }),
				create: () => "ok",
			},
		});

		let router = createRouter({
			middleware: [
				(ctx, next) => {
					ctx.set(Database, new Database("router-db"));
					ctx.set(Scopes, ["posts:read"]);
					return next();
				},
			],
		});
		router.map(routes.mcp, (ctx) => mcp.fetch(ctx));

		let response = await router.fetch(send("tools/call", callParams("get_post", { slug: "x" })));
		let body = (await response.json()) as Body;

		expect(JSON.parse(firstText(body))).toEqual({ db: "router-db", scopes: ["posts:read"] });
	});
});
