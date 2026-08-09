/**
 * Tests for the built-in `http` plugin: request/response shaping per verb,
 * the net permission gate with port derivation, and the absolute-URL rule —
 * all against an MSW server, never a stubbed fetch.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";

import type { Result } from "@pkg/result";

import { failure, isFailure, isSuccess, success, unwrap } from "@pkg/result";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

import type { SpecError } from "../errors";
import type { PermissionSet } from "../permissions";
import type { ToolContext } from "../plugin";
import type { ToolArg, Value, ValueObject } from "../values";
import type { Workspace } from "../workspace";

import { PermissionDeniedError } from "../errors";

import { createHttpPlugin } from "./http";

const SERVER = setupServer();
const PLUGIN = createHttpPlugin();

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

/** A permission set that grants everything, for happy-path calls. */
function allowAll(): PermissionSet {
	return {
		checkRun: () => success(undefined),
		checkNet: () => success(undefined),
		checkEnv: () => success(undefined),
		checkHostFs: () => success(undefined),
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

/** A permission set granting net access to a single port only. */
function allowOnlyPort(granted: number): PermissionSet {
	return {
		...allowAll(),
		checkNet: (host, port) => {
			if (port === granted) return success(undefined);
			return failure(
				new PermissionDeniedError("net", `${host}:${port}`, `spec run --allow-net=${host}:${port}`),
			);
		},
	};
}

/** A workspace stub; http tools never touch the filesystem. */
function stubWorkspace(): Workspace {
	return {
		root: "/tmp/spec-http-tests",
		resolve: (path: string): Result<string, SpecError> => success(path),
		cleanup: async () => undefined,
	};
}

/** Build a tool context from a permission set (defaults to allow-all). */
function buildContext(permissions: PermissionSet = allowAll()): ToolContext {
	return { workspace: stubWorkspace(), permissions };
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

describe(createHttpPlugin.name, () => {
	test("describes five request tools requiring the net grant", () => {
		expect(PLUGIN.namespace).toBe("http");
		let tools = PLUGIN.describe();
		expect(tools.map((tool) => tool.name)).toEqual(["get", "post", "put", "patch", "delete"]);
		for (let tool of tools) {
			expect(tool.kind).toBe("action");
			expect(tool.requires).toBe("net");
			expect(tool.params.map((param) => param.name)).toEqual(["url", "body"]);
			expect(tool.params.map((param) => param.required)).toEqual([true, false]);
		}
	});

	test("get returns status, ok, lowercased headers, text and parsed json", async () => {
		SERVER.use(
			http.get("https://api.example.com/users", () =>
				HttpResponse.json({ users: ["ada"] }, { headers: { "X-Request-Id": "42" } }),
			),
		);
		let result = await PLUGIN.call("get", [value("https://api.example.com/users")], buildContext());
		let data = asObject(unwrap(result));
		expect(data.status).toBe(200);
		expect(data.ok).toBe(true);
		expect(data.json).toEqual({ users: ["ada"] });
		expect(data.text).toBe(JSON.stringify({ users: ["ada"] }));
		let headers = asObject(data.headers);
		expect(headers["x-request-id"]).toBe("42");
		expect(String(headers["content-type"])).toContain("application/json");
	});

	test("post sends an object body as JSON", async () => {
		SERVER.use(
			http.post("https://api.example.com/users", async ({ request }) =>
				HttpResponse.json({
					contentType: request.headers.get("content-type"),
					received: await request.json(),
				}),
			),
		);
		let result = await PLUGIN.call(
			"post",
			[value("https://api.example.com/users"), value({ name: "Ada" })],
			buildContext(),
		);
		let json = asObject(asObject(unwrap(result)).json);
		expect(String(json.contentType)).toContain("application/json");
		expect(json.received).toEqual({ name: "Ada" });
	});

	test("post sends a string body as plain text", async () => {
		SERVER.use(
			http.post("https://api.example.com/notes", async ({ request }) =>
				HttpResponse.json({
					contentType: request.headers.get("content-type"),
					received: await request.text(),
				}),
			),
		);
		let result = await PLUGIN.call(
			"post",
			[value("https://api.example.com/notes"), value("hello world")],
			buildContext(),
		);
		let json = asObject(asObject(unwrap(result)).json);
		expect(String(json.contentType)).toContain("text/plain");
		expect(json.received).toBe("hello world");
	});

	test("put sends an array body as JSON", async () => {
		SERVER.use(
			http.put("https://api.example.com/tags", async ({ request }) =>
				HttpResponse.json({
					contentType: request.headers.get("content-type"),
					received: await request.json(),
				}),
			),
		);
		let result = await PLUGIN.call(
			"put",
			[value("https://api.example.com/tags"), value(["a", "b"])],
			buildContext(),
		);
		let json = asObject(asObject(unwrap(result)).json);
		expect(String(json.contentType)).toContain("application/json");
		expect(json.received).toEqual(["a", "b"]);
	});

	test("patch and delete issue their methods", async () => {
		SERVER.use(
			http.patch("https://api.example.com/item", () => HttpResponse.json({ method: "PATCH" })),
			http.delete("https://api.example.com/item", () => HttpResponse.json({ method: "DELETE" })),
		);
		for (let verb of ["patch", "delete"] as const) {
			let result = await PLUGIN.call(verb, [value("https://api.example.com/item")], buildContext());
			let data = asObject(unwrap(result));
			expect(data.json).toEqual({ method: verb.toUpperCase() });
		}
	});

	test("a non-JSON response body yields json null and the raw text", async () => {
		SERVER.use(
			http.get("https://api.example.com/plain", () =>
				HttpResponse.text("plain text", { headers: { "content-type": "text/plain" } }),
			),
		);
		let result = await PLUGIN.call("get", [value("https://api.example.com/plain")], buildContext());
		let data = asObject(unwrap(result));
		expect(data.json).toBeNull();
		expect(data.text).toBe("plain text");
	});

	test("http error statuses are result values, not failures", async () => {
		SERVER.use(
			http.get("https://api.example.com/missing", () =>
				HttpResponse.json({ error: "missing" }, { status: 404 }),
			),
		);
		let result = await PLUGIN.call(
			"get",
			[value("https://api.example.com/missing")],
			buildContext(),
		);
		let data = asObject(unwrap(result));
		expect(data.status).toBe(404);
		expect(data.ok).toBe(false);
		expect(data.json).toEqual({ error: "missing" });
	});

	test("a denied net grant blocks the request before it goes out", async () => {
		let calls: { host: string; port: number | undefined }[] = [];
		let result = await PLUGIN.call(
			"get",
			[value("https://api.example.com/users")],
			buildContext(denyNet(calls)),
		);
		let error = unwrapError(result);
		expect(error).toBeInstanceOf(PermissionDeniedError);
		expect(error.code).toBe("permission-denied");
		expect(calls).toEqual([{ host: "api.example.com", port: 443 }]);
	});

	test("derives the port from the scheme default or the explicit URL port", async () => {
		let calls: { host: string; port: number | undefined }[] = [];
		let permissions = denyNet(calls);
		await PLUGIN.call("get", [value("http://api.example.com/a")], buildContext(permissions));
		await PLUGIN.call("get", [value("https://api.example.com/b")], buildContext(permissions));
		await PLUGIN.call("get", [value("http://api.example.com:8080/c")], buildContext(permissions));
		expect(calls).toEqual([
			{ host: "api.example.com", port: 80 },
			{ host: "api.example.com", port: 443 },
			{ host: "api.example.com", port: 8080 },
		]);
	});

	test("a port-scoped grant admits exactly its port", async () => {
		SERVER.use(
			http.get("http://api.example.com:8080/ping", () => HttpResponse.json({ pong: true })),
		);
		let allowed = await PLUGIN.call(
			"get",
			[value("http://api.example.com:8080/ping")],
			buildContext(allowOnlyPort(8080)),
		);
		expect(isSuccess(allowed)).toBe(true);
		let denied = await PLUGIN.call(
			"get",
			[value("http://api.example.com:9090/ping")],
			buildContext(allowOnlyPort(8080)),
		);
		let error = unwrapError(denied);
		expect(error.code).toBe("permission-denied");
		expect(error.remedy).toBe("spec run --allow-net=api.example.com:9090");
	});

	test("a relative URL is a tool error naming the environments gap", async () => {
		let result = await PLUGIN.call("get", [value("/health")], buildContext());
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('"/health"');
		expect(error.message).toContain("absolute");
		expect(error.message).toContain("docs/adr/spec/ADR-008");
	});

	test("a non-http scheme is a tool error", async () => {
		let result = await PLUGIN.call("get", [value("ftp://files.example.com/x")], buildContext());
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("http(s)");
	});

	test("a network-level failure is a tool error", async () => {
		SERVER.use(http.get("https://down.example.com/x", () => HttpResponse.error()));
		let result = await PLUGIN.call("get", [value("https://down.example.com/x")], buildContext());
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("https://down.example.com/x");
	});

	test("rejects word arguments", async () => {
		let result = await PLUGIN.call("get", [word("exists")], buildContext());
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('"exists"');
	});

	test("rejects a non-string URL argument", async () => {
		let result = await PLUGIN.call("get", [value(42)], buildContext());
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("URL string");
	});

	test("rejects missing and extra arguments", async () => {
		let missing = unwrapError(await PLUGIN.call("get", [], buildContext()));
		expect(missing.code).toBe("tool-error");
		expect(missing.message).toContain("got 0 arguments");
		let extra = unwrapError(
			await PLUGIN.call(
				"get",
				[value("https://api.example.com/a"), value("x"), value("y")],
				buildContext(),
			),
		);
		expect(extra.code).toBe("tool-error");
		expect(extra.message).toContain("got 3 arguments");
	});

	test("an unknown tool is a tool error listing the available tools", async () => {
		let result = await PLUGIN.call("head", [value("https://api.example.com/a")], buildContext());
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("get, post, put, patch, delete");
	});
});
