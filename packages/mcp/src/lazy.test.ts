/**
 * Executable specification for lazily loaded tool and resource handlers.
 *
 * A handler mapped through `lazy()` is imported by the request that needs it, so a Worker
 * starts without the code behind every tool. Each case pins one promise of that: what is
 * loaded, when, how often, and what a request sees when the import fails.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import { createContextKey, RequestContext } from "remix/router";
import { describe, expect, test, vi } from "vite-plus/test";

import type { ToolMiddleware } from "./tools.js";

import { createHandler } from "./handler.js";
import { lazy } from "./lazy.js";
import { LATEST_PROTOCOL_VERSION, MetaKey } from "./protocol.js";
import { createResource, resource, resources } from "./resources.js";
import { createTool, createToolController, tool, tools } from "./tools.js";

/** The caller's granted scopes, as an app's auth middleware would publish them. */
const Scopes = createContextKey<readonly string[]>();

const toolset = tools({
	ping: tool("ping", { description: "Answers pong.", input: s.object({}) }),
	echo: tool("echo", { description: "Repeats its input.", input: s.object({ text: s.string() }) }),
	admin: tool("admin", { description: "Needs the admin scope.", input: s.object({}) }),
	posts: tools({
		get: tool("get_post", { description: "Reads a post.", input: s.object({ slug: s.string() }) }),
		list: tool("list_posts", { description: "Lists posts.", input: s.object({}) }),
	}),
});

const resourceset = resources({
	article: resource("blog://articles/:slug", { name: "article", mimeType: "text/markdown" }),
	about: resource("blog://about", { name: "about", mimeType: "text/markdown" }),
});

/** A loader's module, shaped as a dynamic `import()` resolves. */
function moduleOf<Value>(value: Value): Promise<{ default: Value }> {
	return Promise.resolve({ default: value });
}

/** A POST carrying the headers and `_meta` this revision requires. */
function send(method: string, params: Record<string, unknown> = {}): Request {
	let headers: Record<string, string> = {
		"Content-Type": "application/json",
		"MCP-Protocol-Version": LATEST_PROTOCOL_VERSION,
		"Mcp-Method": method,
	};
	if (method === "tools/call" && typeof params.name === "string") {
		headers["Mcp-Name"] = params.name;
	}
	if (method === "resources/read" && typeof params.uri === "string") {
		headers["Mcp-Name"] = params.uri;
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
					[MetaKey.ProtocolVersion]: LATEST_PROTOCOL_VERSION,
					[MetaKey.ClientInfo]: { name: "TestClient", version: "1.0.0" },
					[MetaKey.ClientCapabilities]: {},
				},
			},
		}),
	});
}

/** The fields these cases read off a response body. */
interface Body {
	result?: {
		cacheScope?: string;
		tools?: Array<{ name: string }>;
		content?: Array<{ text: string }>;
		contents?: Array<{ uri: string; text: string }>;
		resources?: Array<{ uri: string }>;
		isError?: boolean;
	};
	error?: { message?: string };
}

/** Sends one request through a handler, with the caller's scopes when given. */
async function ask(
	mcp: ReturnType<typeof createHandler>,
	method: string,
	params?: Record<string, unknown>,
	scopes: readonly string[] = [],
): Promise<Body> {
	let ctx = new RequestContext(send(method, params));
	ctx.set(Scopes, scopes);
	let response = await mcp.fetch(ctx);
	return (await response.json()) as Body;
}

/** A fresh handler for each case. */
function build(options: Partial<Parameters<typeof createHandler>[0]> = {}) {
	return createHandler({ name: "test-server", version: "1.0.0", ...options });
}

describe("lazy tools", () => {
	test("loads nothing when mapped, nor for a request that names no tool", async () => {
		let load = vi.fn(() => moduleOf(createTool(toolset.ping, () => "pong")));
		let mcp = build();
		mcp.tools.map(toolset.ping, lazy(load));

		await ask(mcp, "server/discover");

		expect(load).not.toHaveBeenCalled();
	});

	test("loads the called tool's module and runs its handler", async () => {
		let mcp = build();
		mcp.tools.map(
			toolset.echo,
			lazy(() => moduleOf(createTool(toolset.echo, (ctx) => ctx.input.text))),
		);

		let body = await ask(mcp, "tools/call", { name: "echo", arguments: { text: "hi" } });

		expect(body.result?.content?.[0]?.text).toBe("hi");
	});

	test("loads only the tool that was called", async () => {
		let pingLoad = vi.fn(() => moduleOf(createTool(toolset.ping, () => "pong")));
		let echoLoad = vi.fn(() => moduleOf(createTool(toolset.echo, (ctx) => ctx.input.text)));
		let mcp = build();
		mcp.tools.map(toolset.ping, lazy(pingLoad));
		mcp.tools.map(toolset.echo, lazy(echoLoad));

		await ask(mcp, "tools/call", { name: "ping", arguments: {} });

		expect(pingLoad).toHaveBeenCalledTimes(1);
		expect(echoLoad).not.toHaveBeenCalled();
	});

	test("imports a module once, however many calls reach it", async () => {
		let load = vi.fn(() => moduleOf(createTool(toolset.ping, () => "pong")));
		let mcp = build();
		mcp.tools.map(toolset.ping, lazy(load));

		await Promise.all([
			ask(mcp, "tools/call", { name: "ping", arguments: {} }),
			ask(mcp, "tools/call", { name: "ping", arguments: {} }),
		]);
		await ask(mcp, "tools/call", { name: "ping", arguments: {} });

		expect(load).toHaveBeenCalledTimes(1);
	});

	test("keeps an unknown tool from loading anything", async () => {
		let load = vi.fn(() => moduleOf(createTool(toolset.ping, () => "pong")));
		let mcp = build();
		mcp.tools.map(toolset.ping, lazy(load));

		let body = await ask(mcp, "tools/call", { name: "nope", arguments: {} });

		expect(body.error?.message).toBe("Unknown tool: nope");
		expect(load).not.toHaveBeenCalled();
	});

	test("runs the middleware the loaded action declares, after the handler-wide chain", async () => {
		let order: string[] = [];
		let mark =
			(label: string): ToolMiddleware =>
			async (_ctx, next) => {
				order.push(label);
				return next();
			};
		let mcp = build({ toolMiddleware: [mark("handler")] });
		mcp.tools.map(
			toolset.ping,
			lazy(() =>
				moduleOf(
					createTool(toolset.ping, {
						middleware: [mark("action")],
						handler: () => "pong",
					}),
				),
			),
		);

		await ask(mcp, "tools/call", { name: "ping", arguments: {} });

		expect(order).toEqual(["handler", "action"]);
	});

	test("lists a lazy tool from its declaration", async () => {
		let mcp = build();
		mcp.tools.map(
			toolset.ping,
			lazy(() => moduleOf(createTool(toolset.ping, () => "pong"))),
		);

		let body = await ask(mcp, "tools/list");

		expect(body.result?.tools?.map((entry) => entry.name)).toEqual(["ping"]);
	});

	test("hides a tool whose loaded action is unavailable to the caller", async () => {
		let action = createTool(toolset.admin, {
			available: (ctx) => (ctx.get(Scopes) ?? []).includes("admin"),
			handler: () => "done",
		});
		let mcp = build();
		mcp.tools.map(
			toolset.admin,
			lazy(() => moduleOf(action)),
		);

		let hidden = await ask(mcp, "tools/list");
		let shown = await ask(mcp, "tools/list", {}, ["admin"]);
		let refused = await ask(mcp, "tools/call", { name: "admin", arguments: {} });

		expect(hidden.result?.tools).toEqual([]);
		expect(shown.result?.tools?.map((entry) => entry.name)).toEqual(["admin"]);
		expect(refused.error?.message).toBe("Unknown tool: admin");
	});

	test("answers tools/list in declaration order whichever modules loaded first", async () => {
		let mcp = build();
		mcp.tools.map(
			toolset.ping,
			lazy(() => moduleOf(createTool(toolset.ping, () => "pong"))),
		);
		mcp.tools.map(toolset.echo, (ctx) => ctx.input.text);

		let body = await ask(mcp, "tools/list");

		expect(body.result?.tools?.map((entry) => entry.name)).toEqual(["ping", "echo"]);
	});

	test("marks the list private, because a module's visibility is unknown until it loads", async () => {
		let mcp = build();
		mcp.tools.map(
			toolset.ping,
			lazy(() => moduleOf(createTool(toolset.ping, () => "pong"))),
		);

		let body = await ask(mcp, "tools/list");

		expect(body.result?.cacheScope).toBe("private");
	});

	test("honors an explicit cacheScope over the private default", async () => {
		let mcp = build({ cacheScope: "public" });
		mcp.tools.map(
			toolset.ping,
			lazy(() => moduleOf(createTool(toolset.ping, () => "pong"))),
		);

		let body = await ask(mcp, "tools/list");

		expect(body.result?.cacheScope).toBe("public");
	});

	test("still refuses to map a tool twice", () => {
		let mcp = build();
		mcp.tools.map(toolset.ping, () => "pong");

		expect(() =>
			mcp.tools.map(
				toolset.ping,
				lazy(() => moduleOf(createTool(toolset.ping, () => "pong"))),
			),
		).toThrow('Tool "ping" is already mapped');
	});

	test("reports a failed import as a generic failure and retries it on the next call", async () => {
		let attempts = 0;
		let onError = vi.fn();
		let mcp = build({ onError });
		mcp.tools.map(
			toolset.ping,
			lazy(() => {
				attempts += 1;
				if (attempts === 1) return Promise.reject(new Error("chunk failed to load"));
				return moduleOf(createTool(toolset.ping, () => "pong"));
			}),
		);

		let failed = await ask(mcp, "tools/call", { name: "ping", arguments: {} });
		let retried = await ask(mcp, "tools/call", { name: "ping", arguments: {} });

		expect(failed.result?.isError).toBe(true);
		expect(failed.result?.content?.[0]?.text).toBe("The ping tool failed unexpectedly.");
		expect(onError).toHaveBeenCalledWith(
			expect.objectContaining({ message: "chunk failed to load" }),
			{
				method: "tools/call",
				tool: "ping",
			},
		);
		expect(retried.result?.content?.[0]?.text).toBe("pong");
	});
});

describe("lazy tool groups", () => {
	/** A controller module for `toolset.posts`, counting how often it loads. */
	function postsController() {
		let load = vi.fn(() =>
			moduleOf(
				createToolController(toolset.posts, {
					middleware: [
						async (_ctx, next) => {
							let result = await next();
							return { ...result, structuredContent: { grouped: true } };
						},
					],
					actions: {
						get: (ctx) => `post:${ctx.input.slug}`,
						list: () => "all posts",
					},
				}),
			),
		);
		return load;
	}

	test("shares one load across every tool in the group", async () => {
		let load = postsController();
		let mcp = build();
		mcp.tools.map(toolset.posts, lazy(load));

		await ask(mcp, "tools/call", { name: "get_post", arguments: { slug: "a" } });
		await ask(mcp, "tools/call", { name: "list_posts", arguments: {} });

		expect(load).toHaveBeenCalledTimes(1);
	});

	test("runs the call with the action and middleware the controller declares", async () => {
		let mcp = build();
		mcp.tools.map(toolset.posts, lazy(postsController()));

		let body = await ask(mcp, "tools/call", { name: "get_post", arguments: { slug: "a" } });

		expect(body.result?.content?.[0]?.text).toBe("post:a");
		expect((body.result as { structuredContent?: unknown }).structuredContent).toEqual({
			grouped: true,
		});
	});

	test("lists every tool the group declares", async () => {
		let mcp = build();
		mcp.tools.map(toolset.posts, lazy(postsController()));

		let body = await ask(mcp, "tools/list");

		expect(body.result?.tools?.map((entry) => entry.name)).toEqual(["get_post", "list_posts"]);
	});
});

describe("lazy resources", () => {
	test("loads nothing for a request that reads no resource", async () => {
		let load = vi.fn(() => moduleOf(createResource(resourceset.about, { read: () => "About" })));
		let mcp = build();
		mcp.resources.map(resourceset.about, lazy(load));

		await ask(mcp, "server/discover");

		expect(load).not.toHaveBeenCalled();
	});

	test("loads only the resource a read matches", async () => {
		let aboutLoad = vi.fn(() =>
			moduleOf(createResource(resourceset.about, { read: () => "About" })),
		);
		let articleLoad = vi.fn(() =>
			moduleOf(createResource(resourceset.article, { read: (ctx) => `# ${ctx.variables.slug}` })),
		);
		let mcp = build();
		mcp.resources.map(resourceset.about, lazy(aboutLoad));
		mcp.resources.map(resourceset.article, lazy(articleLoad));

		let body = await ask(mcp, "resources/read", { uri: "blog://articles/hello" });

		expect(body.result?.contents?.[0]?.text).toBe("# hello");
		expect(articleLoad).toHaveBeenCalledTimes(1);
		expect(aboutLoad).not.toHaveBeenCalled();
	});

	test("imports a module once across reads", async () => {
		let load = vi.fn(() =>
			moduleOf(createResource(resourceset.article, { read: (ctx) => ctx.variables.slug })),
		);
		let mcp = build();
		mcp.resources.map(resourceset.article, lazy(load));

		await Promise.all([
			ask(mcp, "resources/read", { uri: "blog://articles/a" }),
			ask(mcp, "resources/read", { uri: "blog://articles/b" }),
		]);

		expect(load).toHaveBeenCalledTimes(1);
	});

	test("lists the entries the loaded action's list returns", async () => {
		let mcp = build();
		mcp.resources.map(
			resourceset.article,
			lazy(() =>
				moduleOf(
					createResource(resourceset.article, {
						list: () => [{ uri: resourceset.article.href({ slug: "a" }), name: "a" }],
						read: () => "",
					}),
				),
			),
		);

		let body = await ask(mcp, "resources/list");

		expect(body.result?.resources?.map((entry) => entry.uri)).toEqual(["blog://articles/a"]);
	});

	test("hides a resource whose loaded action is unavailable to the caller", async () => {
		let mcp = build();
		mcp.resources.map(
			resourceset.about,
			lazy(() =>
				moduleOf(
					createResource(resourceset.about, {
						available: (ctx) => (ctx.get(Scopes) ?? []).includes("staff"),
						read: () => "About",
					}),
				),
			),
		);

		let hidden = await ask(mcp, "resources/read", { uri: "blog://about" });
		let shown = await ask(mcp, "resources/read", { uri: "blog://about" }, ["staff"]);

		expect(hidden.error?.message).toBe("Resource not found");
		expect(shown.result?.contents?.[0]?.text).toBe("About");
	});

	test("reports a failed import as a failed read and retries it on the next one", async () => {
		let attempts = 0;
		let onError = vi.fn();
		let mcp = build({ onError });
		mcp.resources.map(
			resourceset.about,
			lazy(() => {
				attempts += 1;
				if (attempts === 1) return Promise.reject(new Error("chunk failed to load"));
				return moduleOf(createResource(resourceset.about, { read: () => "About" }));
			}),
		);

		let failed = await ask(mcp, "resources/read", { uri: "blog://about" });
		let retried = await ask(mcp, "resources/read", { uri: "blog://about" });

		expect(failed.error?.message).toBe("Failed to read the resource");
		expect(onError).toHaveBeenCalledWith(
			expect.objectContaining({ message: "chunk failed to load" }),
			{
				method: "resources/read",
				uri: "blog://about",
			},
		);
		expect(retried.result?.contents?.[0]?.text).toBe("About");
	});
});

describe("lazy typing", () => {
	test("accepts a module that default-exports a tool's action", () => {
		let mcp = build();

		mcp.tools.map(
			toolset.echo,
			lazy(() => moduleOf(createTool(toolset.echo, (ctx) => ctx.input.text))),
		);
	});

	test("rejects a module whose default export is not an action", () => {
		let mcp = build();

		mcp.tools.map(
			// @ts-expect-error -- a number is neither a handler nor an action object
			toolset.echo,
			lazy(() => moduleOf(42)),
		);
	});
});
