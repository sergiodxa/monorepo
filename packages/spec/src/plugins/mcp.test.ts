/**
 * Tests for the built-in `mcp` plugin: JSON-RPC shaping for discover, list_tools
 * and call, the net permission gate, base resolution, and auth headers — all
 * against a real MSW server answering the Streamable HTTP protocol.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";

import { failure, isFailure, success, unwrap } from "@sdxc/result";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { Base } from "../bases.js";
import type { SpecError } from "../errors.js";
import type { PermissionSet } from "../permissions.js";
import type { ToolContext } from "../plugin.js";
import type { ToolArg, Value, ValueObject } from "../values.js";

import { createBaseSet } from "../bases.js";
import { PermissionDeniedError } from "../errors.js";
import { createToolContext } from "../tool-context.js";

import { createMcpPlugin } from "./mcp.js";

const SERVER = setupServer();
const PLUGIN = createMcpPlugin();

beforeAll(() => SERVER.listen({ onUnhandledRequest: "error" }));
afterEach(() => SERVER.resetHandlers());
afterAll(() => SERVER.close());

/** Wrap a runtime value as a positional value argument. */
function value(data: Value): ToolArg {
	return { kind: "value", value: data };
}

/** Wrap a bare identifier as a word argument. */
function word(name: string): ToolArg {
	return { kind: "word", word: name };
}

/** A permission set that grants everything. */
function allowAll(): PermissionSet {
	return {
		checkRun: () => success(undefined),
		checkNet: () => success(undefined),
		checkEnv: () => success(undefined),
		checkHostFs: () => success(undefined),
		checkDb: () => success(undefined),
		grantedEnvNames: () => [],
	};
}

/** A permission set denying net, recording the host and port it was asked about. */
function denyNet(calls: { host: string; port: number | undefined }[]): PermissionSet {
	return {
		...allowAll(),
		checkNet: (host, port) => {
			calls.push({ host, port });
			return failure(new PermissionDeniedError("net", host, `spec run --allow-net=${host}`));
		},
	};
}

/** Build a tool context from a permission set (defaults to allow-all). */
function buildContext(permissions: PermissionSet = allowAll(), bases: Base[] = []): ToolContext {
	return createToolContext({ permissions, bases: createBaseSet(bases) });
}

/** Narrow a value to an object, failing the test otherwise. */
function asObject(data: Value | undefined): ValueObject {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		throw new Error(`expected an object value, got ${JSON.stringify(data)}`);
	}
	return data;
}

/** Unwrap a failed result into its error, failing the test on success. */
function unwrapError(result: Result<Value, SpecError>): SpecError {
	if (!isFailure(result)) {
		throw new Error(`expected a failure, got ${JSON.stringify(result.data)}`);
	}
	return result.error;
}

/** A JSON-RPC success envelope. */
function rpcResult(result: Record<string, unknown>) {
	return HttpResponse.json({ jsonrpc: "2.0", id: 1, result });
}

describe(createMcpPlugin.name, () => {
	test("describes discover, list_tools and call requiring the net grant", () => {
		expect(PLUGIN.namespace).toBe("mcp");
		let tools = PLUGIN.describe();
		expect(tools.map((tool) => tool.name)).toEqual(["discover", "list_tools", "call"]);
		expect(tools.map((tool) => tool.requires)).toEqual(["net", "net", "net"]);
		expect(tools.map((tool) => tool.kind)).toEqual(["observable", "observable", "action"]);
	});

	test("discover posts server/discover and shapes capabilities", async () => {
		let seen: { method?: string | null; version?: string | null; body?: ValueObject } = {};
		SERVER.use(
			http.post("https://api.example.com/mcp", async ({ request }) => {
				seen.method = request.headers.get("Mcp-Method");
				seen.version = request.headers.get("MCP-Protocol-Version");
				seen.body = (await request.json()) as ValueObject;
				return rpcResult({
					resultType: "complete",
					supportedVersions: ["2026-07-28"],
					capabilities: { tools: { listChanged: false } },
					instructions: "Call list_tools first.",
				});
			}),
		);

		let result = asObject(
			unwrap(await PLUGIN.call("discover", [value("https://api.example.com/mcp")], buildContext())),
		);

		expect(seen.method).toBe("server/discover");
		expect(seen.version).toBe("2026-07-28");
		expect(seen.body?.method).toBe("server/discover");
		expect(result.ok).toBe(true);
		expect(result.status).toBe(200);
		expect(result.capabilities).toEqual({ tools: { listChanged: false } });
		expect(result.instructions).toBe("Call list_tools first.");
		expect(result.supported_versions).toEqual(["2026-07-28"]);
	});

	test("list_tools returns the tools array", async () => {
		SERVER.use(
			http.post("https://api.example.com/mcp", () =>
				rpcResult({
					resultType: "complete",
					tools: [{ name: "ping", description: "Answers pong." }],
				}),
			),
		);

		let result = asObject(
			unwrap(
				await PLUGIN.call("list_tools", [value("https://api.example.com/mcp")], buildContext()),
			),
		);

		expect(result.ok).toBe(true);
		expect(result.tools).toEqual([{ name: "ping", description: "Answers pong." }]);
	});

	test("call posts tools/call with name and arguments and surfaces text and json", async () => {
		let seen: {
			method?: string | null;
			name?: string | null;
			body?: ValueObject;
		} = {};
		SERVER.use(
			http.post("https://api.example.com/mcp", async ({ request }) => {
				seen.method = request.headers.get("Mcp-Method");
				seen.name = request.headers.get("Mcp-Name");
				seen.body = (await request.json()) as ValueObject;
				return rpcResult({
					resultType: "complete",
					content: [{ type: "text", text: '{"slug":"hello"}' }],
					structuredContent: { slug: "hello" },
					isError: false,
				});
			}),
		);

		let result = asObject(
			unwrap(
				await PLUGIN.call(
					"call",
					[value("https://api.example.com/mcp"), value("get_post"), value({ slug: "hello" })],
					buildContext(),
				),
			),
		);

		expect(seen.method).toBe("tools/call");
		expect(seen.name).toBe("get_post");
		let params = asObject(seen.body?.params);
		expect(params.name).toBe("get_post");
		expect(params.arguments).toEqual({ slug: "hello" });
		expect(result.ok).toBe(true);
		expect(result.is_error).toBe(false);
		expect(result.text).toBe('{"slug":"hello"}');
		expect(result.json).toEqual({ slug: "hello" });
		expect(result.result_type).toBe("complete");
	});

	test("call omits arguments as an empty object", async () => {
		let seen: ValueObject | undefined;
		SERVER.use(
			http.post("https://api.example.com/mcp", async ({ request }) => {
				seen = (await request.json()) as ValueObject;
				return rpcResult({
					resultType: "complete",
					content: [{ type: "text", text: "pong" }],
				});
			}),
		);

		await PLUGIN.call(
			"call",
			[value("https://api.example.com/mcp"), value("ping")],
			buildContext(),
		);

		expect(asObject(seen?.params).arguments).toEqual({});
	});

	test("call reports tool-level is_error without failing ok when HTTP succeeds", async () => {
		SERVER.use(
			http.post("https://api.example.com/mcp", () =>
				rpcResult({
					resultType: "complete",
					content: [{ type: "text", text: "not found" }],
					isError: true,
				}),
			),
		);

		let result = asObject(
			unwrap(
				await PLUGIN.call(
					"call",
					[value("https://api.example.com/mcp"), value("get_post"), value({})],
					buildContext(),
				),
			),
		);

		expect(result.ok).toBe(true);
		expect(result.is_error).toBe(true);
		expect(result.text).toBe("not found");
	});

	test("a JSON-RPC error sets ok false and surfaces the error object", async () => {
		SERVER.use(
			http.post("https://api.example.com/mcp", () =>
				HttpResponse.json({
					jsonrpc: "2.0",
					id: 1,
					error: { code: -32602, message: "Unknown tool" },
				}),
			),
		);

		let result = asObject(
			unwrap(
				await PLUGIN.call(
					"call",
					[value("https://api.example.com/mcp"), value("missing")],
					buildContext(),
				),
			),
		);

		expect(result.ok).toBe(false);
		expect(result.error).toEqual({ code: -32602, message: "Unknown tool" });
	});

	test("checks the net grant against the resolved host and port", async () => {
		let calls: { host: string; port: number | undefined }[] = [];
		let result = unwrapError(
			await PLUGIN.call(
				"list_tools",
				[value("https://api.example.com:8443/mcp")],
				buildContext(denyNet(calls)),
			),
		);

		expect(result).toBeInstanceOf(PermissionDeniedError);
		expect(calls).toEqual([{ host: "api.example.com", port: 8443 }]);
	});

	test("resolves a relative target through a named base", async () => {
		SERVER.use(
			http.post("https://web.test/mcp", () =>
				rpcResult({ resultType: "complete", tools: [{ name: "ping" }] }),
			),
		);

		let result = asObject(
			unwrap(
				await PLUGIN.call(
					"list_tools",
					[value("/mcp"), word("on"), value("web")],
					buildContext(allowAll(), [{ name: "web", url: "https://web.test" }]),
				),
			),
		);

		expect(result.ok).toBe(true);
		expect(result.tools).toEqual([{ name: "ping" }]);
	});

	test("sends a bearer token as Authorization", async () => {
		let authorization: string | null = null;
		SERVER.use(
			http.post("https://api.example.com/mcp", ({ request }) => {
				authorization = request.headers.get("authorization");
				return rpcResult({ resultType: "complete", tools: [] });
			}),
		);

		await PLUGIN.call(
			"list_tools",
			[value("https://api.example.com/mcp"), word("bearer"), value("secret")],
			buildContext(),
		);

		expect(authorization).toBe("Bearer secret");
	});

	test("refuses a non-object call arguments value", async () => {
		let result = unwrapError(
			await PLUGIN.call(
				"call",
				[value("https://api.example.com/mcp"), value("ping"), value("nope")],
				buildContext(),
			),
		);

		expect(result.message).toContain("arguments must be an object");
	});

	test("refuses an unknown tool name", async () => {
		let result = unwrapError(await PLUGIN.call("invoke", [], buildContext()));
		expect(result.message).toContain('mcp has no tool "invoke"');
	});
});
