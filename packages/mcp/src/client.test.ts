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
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { connect, McpClientError } from "./client.js";
import { rpc } from "./client/rpc.js";
import { createHandler } from "./handler.js";
import { ErrorCode } from "./jsonrpc.js";
import { LATEST_PROTOCOL_VERSION, MetaKey } from "./protocol.js";
import { resource, resources } from "./resources.js";
import { tool, tools } from "./tools.js";

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
});
