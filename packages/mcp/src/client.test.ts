/**
 * Client session behavior against MSW and an in-package `createHandler`: one-word
 * methods, Result-shaped failures, Disposable/`using` teardown, and `-32022` retry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@sdxc/json-schema";
import { isFailure, isSuccess, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, expectTypeOf, test } from "vitest";

import { connect, InvalidToolResultError, McpClientError } from "./client.js";
import { rpc } from "./client/rpc.js";
import { createHandler } from "./handler.js";
import { ErrorCode } from "./jsonrpc.js";
import { LATEST_PROTOCOL_VERSION, MetaKey } from "./protocol.js";
import { resource, resources } from "./resources.js";
import { tool, tools } from "./tools.js";

/** First-party catalog used to prove `connect<Tools>` types names and args. */
interface PingTools {
	ping: { input: { message: string }; output: { reply: string } };
}

/** Schema for a structured ping result. */
const PingOutput = s.object({ reply: s.string() });

const SERVER = setupServer();

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterEach(() => SERVER.resetHandlers());
afterAll(() => SERVER.close());

const CLIENT = { name: "test-client", version: "1.0.0" };
const ENDPOINT = "https://mcp.example/mcp";

/** Builds a small in-package server and answers MSW with its `fetch`. */
function mountHandler(): ReturnType<typeof createHandler> {
	let toolset = tools({
		ping: tool("ping", {
			description: "Returns pong.",
			input: s.object({ message: s.string() }),
		}),
	});
	let resourceset = resources({
		note: resource("notes://:id", {
			name: "Note",
			description: "A note.",
			mimeType: "text/plain",
		}),
	});
	let mcp = createHandler({ name: "test-server", version: "1.0.0", instructions: "Ping." });
	mcp.tools.map(toolset.ping, (ctx) => `pong:${ctx.input.message}`);
	mcp.resources.map(resourceset.note, {
		list: () => [{ uri: "notes://a", name: "A" }],
		read: (ctx) => `body:${ctx.variables.id}`,
	});
	SERVER.use(
		http.post(ENDPOINT, async ({ request }) => {
			let response = await mcp.fetch(request);
			return new HttpResponse(await response.text(), {
				status: response.status,
				headers: response.headers,
			});
		}),
	);
	return mcp;
}

describe("connect", () => {
	test("lists tools, calls one, and reads resources against createHandler", async () => {
		mountHandler();
		using mcp = connect({ url: ENDPOINT, client: CLIENT });

		let discovered = unwrap(await mcp.discover());
		expect(discovered.instructions).toBe("Ping.");
		expect(discovered.supportedVersions).toEqual([LATEST_PROTOCOL_VERSION]);

		let listed = unwrap(await mcp.list());
		expect(listed.tools.map((entry) => entry.name)).toEqual(["ping"]);

		let called = unwrap(await mcp.call("ping", { message: "hi" }));
		expect(called.isError).toBeUndefined();
		expect(called.content[0]?.text).toBe("pong:hi");

		let listedResources = unwrap(await mcp.resources());
		expect(listedResources.resources).toEqual([{ uri: "notes://a", name: "A" }]);

		let templates = unwrap(await mcp.templates());
		expect(templates.resourceTemplates[0]?.uriTemplate).toBe("notes://{id}");

		let read = unwrap(await mcp.read("notes://a"));
		expect(read.contents[0]?.text).toBe("body:a");
	});

	test("returns a Result failure for a JSON-RPC error", async () => {
		SERVER.use(
			http.post(ENDPOINT, () =>
				HttpResponse.json({
					jsonrpc: "2.0",
					id: "x",
					error: { code: ErrorCode.MethodNotFound, message: "no such method" },
				}),
			),
		);
		using mcp = connect({ url: ENDPOINT, client: CLIENT });
		let result = await mcp.list();
		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("expected failure");
		expect(result.error).toBeInstanceOf(McpClientError);
		expect(result.error.code).toBe(ErrorCode.MethodNotFound);
		expect(result.error.message).toBe("no such method");
	});

	test("does not retry UnsupportedProtocolVersion when the intersection is the version already sent", async () => {
		let attempts = 0;
		SERVER.use(
			http.post(ENDPOINT, () => {
				attempts += 1;
				return HttpResponse.json(
					{
						jsonrpc: "2.0",
						id: 1,
						error: {
							code: ErrorCode.UnsupportedProtocolVersion,
							message: "Unsupported protocol version",
							data: { supported: [LATEST_PROTOCOL_VERSION] },
						},
					},
					{ status: 400 },
				);
			}),
		);

		using mcp = connect({ url: ENDPOINT, client: CLIENT });
		let result = await mcp.list();
		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("expected failure");
		expect(result.error.code).toBe(ErrorCode.UnsupportedProtocolVersion);
		expect(attempts).toBe(1);
	});

	test("retries once when UnsupportedProtocolVersion offers a different shared revision", async () => {
		let attempts: string[] = [];
		SERVER.use(
			http.post(ENDPOINT, async ({ request }) => {
				let version = request.headers.get("MCP-Protocol-Version") ?? "";
				attempts.push(version);
				if (version !== LATEST_PROTOCOL_VERSION) {
					return HttpResponse.json(
						{
							jsonrpc: "2.0",
							id: 1,
							error: {
								code: ErrorCode.UnsupportedProtocolVersion,
								message: "Unsupported protocol version",
								data: { supported: [LATEST_PROTOCOL_VERSION] },
							},
						},
						{ status: 400 },
					);
				}
				let body = (await request.json()) as {
					params?: { _meta?: Record<string, unknown> };
				};
				expect(body.params?._meta?.[MetaKey.ProtocolVersion]).toBe(LATEST_PROTOCOL_VERSION);
				return HttpResponse.json({
					jsonrpc: "2.0",
					id: 1,
					result: {
						resultType: "complete",
						tools: [],
						ttlMs: 60_000,
						cacheScope: "public",
					},
				});
			}),
		);

		let result = await rpc(
			"tools/list",
			{},
			{
				url: new URL(ENDPOINT),
				client: CLIENT,
				headers: undefined,
				credentials: undefined,
				signal: new AbortController().signal,
				protocolVersion: "2025-11-25",
			},
		);
		expect(isSuccess(result)).toBe(true);
		expect(attempts).toEqual(["2025-11-25", LATEST_PROTOCOL_VERSION]);
	});

	test("close aborts further RPCs and matches Symbol.dispose", async () => {
		mountHandler();
		let mcp = connect({ url: ENDPOINT, client: CLIENT });
		mcp.close();
		let result = await mcp.list();
		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("expected failure");
		expect(result.error.message).toBe("MCP client session is closed");

		let again = connect({ url: ENDPOINT, client: CLIENT });
		again[Symbol.dispose]();
		expect(isFailure(await again.discover())).toBe(true);
	});

	test("using disposes the session at end of scope", async () => {
		mountHandler();
		let session: ReturnType<typeof connect> | undefined;
		{
			using mcp = connect({ url: ENDPOINT, client: CLIENT });
			session = mcp;
			expect(isSuccess(await mcp.list())).toBe(true);
		}
		expect(session).toBeDefined();
		expect(isFailure(await session!.list())).toBe(true);
	});

	test("treats a tool isError result as a successful RPC", async () => {
		SERVER.use(
			http.post(ENDPOINT, () =>
				HttpResponse.json({
					jsonrpc: "2.0",
					id: 1,
					result: {
						resultType: "complete",
						content: [{ type: "text", text: "Try a different query." }],
						isError: true,
					},
				}),
			),
		);
		using mcp = connect({ url: ENDPOINT, client: CLIENT });
		let result = unwrap(await mcp.call("missing"));
		expect(result.isError).toBe(true);
		expect(result.content[0]?.text).toBe("Try a different query.");
	});

	test("connect<Tools> types call names and arguments", async () => {
		SERVER.use(
			http.post(ENDPOINT, () =>
				HttpResponse.json({
					jsonrpc: "2.0",
					id: 1,
					result: {
						resultType: "complete",
						content: [{ type: "text", text: '{"reply":"pong"}' }],
						structuredContent: { reply: "pong" },
					},
				}),
			),
		);
		using mcp = connect<PingTools>({ url: ENDPOINT, client: CLIENT });
		let result = unwrap(await mcp.call("ping", { message: "hi" }));
		expectTypeOf(result.structuredContent).toEqualTypeOf<{ reply: string } | undefined>();
		expectTypeOf<keyof PingTools>().toEqualTypeOf<"ping">();
		expectTypeOf<PingTools["ping"]["input"]>().toEqualTypeOf<{ message: string }>();
	});

	test("validates structuredContent with a result schema", async () => {
		let sentArguments: unknown;
		SERVER.use(
			http.post(ENDPOINT, async ({ request }) => {
				let body = (await request.json()) as {
					params?: { arguments?: unknown };
				};
				sentArguments = body.params?.arguments;
				return HttpResponse.json({
					jsonrpc: "2.0",
					id: 1,
					result: {
						resultType: "complete",
						content: [{ type: "text", text: JSON.stringify({ reply: "pong" }) }],
						structuredContent: { reply: "pong" },
					},
				});
			}),
		);
		using mcp = connect({ url: ENDPOINT, client: CLIENT });
		let result = unwrap(await mcp.call("ping", { message: "hi", schema: PingOutput }));
		expect(sentArguments).toEqual({ message: "hi" });
		expect(result.structuredContent).toEqual({ reply: "pong" });
		expectTypeOf(result.structuredContent).toEqualTypeOf<{ reply: string } | undefined>();
	});

	test("strips schema from arguments sent to tools/call", async () => {
		let sentArguments: unknown;
		SERVER.use(
			http.post(ENDPOINT, async ({ request }) => {
				let body = (await request.json()) as {
					params?: { arguments?: unknown };
				};
				sentArguments = body.params?.arguments;
				return HttpResponse.json({
					jsonrpc: "2.0",
					id: 1,
					result: {
						resultType: "complete",
						content: [{ type: "text", text: '{"reply":"ok"}' }],
						structuredContent: { reply: "ok" },
					},
				});
			}),
		);
		using mcp = connect<PingTools>({ url: ENDPOINT, client: CLIENT });
		unwrap(await mcp.call("ping", { message: "hi", schema: PingOutput }));
		expect(sentArguments).toEqual({ message: "hi" });
		expect(sentArguments).not.toHaveProperty("schema");
	});

	test("fails the Result when a result schema does not match", async () => {
		SERVER.use(
			http.post(ENDPOINT, () =>
				HttpResponse.json({
					jsonrpc: "2.0",
					id: 1,
					result: {
						resultType: "complete",
						content: [{ type: "text", text: "{}" }],
						structuredContent: { reply: 12 },
					},
				}),
			),
		);
		using mcp = connect({ url: ENDPOINT, client: CLIENT });
		let result = await mcp.call("ping", { message: "hi", schema: PingOutput });
		expect(isFailure(result)).toBe(true);
		if (!isFailure(result)) throw new Error("expected failure");
		expect(result.error).toBeInstanceOf(InvalidToolResultError);
		if (!(result.error instanceof InvalidToolResultError)) {
			throw new Error("expected InvalidToolResultError");
		}
		expect(result.error.issues.some((issue) => issue.includes("reply"))).toBe(true);
	});

	test("validates JSON text content when structuredContent is absent", async () => {
		SERVER.use(
			http.post(ENDPOINT, () =>
				HttpResponse.json({
					jsonrpc: "2.0",
					id: 1,
					result: {
						resultType: "complete",
						content: [{ type: "text", text: JSON.stringify({ reply: "from-text" }) }],
					},
				}),
			),
		);
		using mcp = connect({ url: ENDPOINT, client: CLIENT });
		let result = unwrap(await mcp.call("ping", { schema: PingOutput }));
		expect(result.structuredContent).toEqual({ reply: "from-text" });
	});

	test("skips result schema validation when the tool reported isError", async () => {
		SERVER.use(
			http.post(ENDPOINT, () =>
				HttpResponse.json({
					jsonrpc: "2.0",
					id: 1,
					result: {
						resultType: "complete",
						content: [{ type: "text", text: "missing" }],
						isError: true,
					},
				}),
			),
		);
		using mcp = connect({ url: ENDPOINT, client: CLIENT });
		let result = unwrap(await mcp.call("ping", { schema: PingOutput }));
		expect(result.isError).toBe(true);
		expect(result.structuredContent).toBeUndefined();
	});
});
