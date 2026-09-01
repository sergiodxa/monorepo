/**
 * Tests for the built-in `http` plugin: request/response shaping per verb,
 * the net permission gate with port derivation, and the absolute-URL rule —
 * all against a real MSW server.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@pkg/result";

import { failure, isFailure, isSuccess, success, unwrap } from "@pkg/result";
import { createRandom } from "@pkg/sample";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

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

/** A permission set granting net access to a single host only. */
function allowOnlyHost(granted: string): PermissionSet {
	return {
		...allowAll(),
		checkNet: (host) => {
			if (host === granted) return success(undefined);
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

/** A workspace stub; http tools operate entirely over the network. */
function stubWorkspace(): Workspace {
	return {
		root: "/tmp/spec-http-tests",
		resolve: (path: string): Result<string, SpecError> => success(path),
		cleanup: async () => undefined,
	};
}

/** Build a tool context from a permission set (defaults to allow-all). */
function buildContext(permissions: PermissionSet = allowAll()): ToolContext {
	return {
		workspace: stubWorkspace(),
		permissions,
		random: createRandom("test"),
		now: new Date("2026-01-01T00:00:00.000Z"),
	};
}

/** Narrow a value to an object, failing the test otherwise. */
function asObject(data: Value | undefined): ValueObject {
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		throw new Error(`expected an object value, got ${JSON.stringify(data)}`);
	}
	return data;
}

/** Narrow a value to a string, failing the test otherwise. */
function asString(data: Value | undefined): string {
	if (typeof data !== "string") {
		throw new Error(`expected a string value, got ${JSON.stringify(data)}`);
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
			expect(tool.params.map((param) => param.name)).toEqual([
				"url",
				"body",
				"headers",
				"form",
				"json",
				"text",
				"bearer",
				"basic",
			]);
			expect(tool.params.map((param) => param.required)).toEqual([
				true,
				false,
				false,
				false,
				false,
				false,
				false,
				false,
			]);
			expect(tool.params.map((param) => param.kind)).toEqual([
				"value",
				"value",
				"word",
				"word",
				"word",
				"word",
				"word",
				"word",
			]);
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
		expect(asString(headers["content-type"])).toContain("application/json");
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
		expect(asString(json.contentType)).toContain("application/json");
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
		expect(asString(json.contentType)).toContain("text/plain");
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
		expect(asString(json.contentType)).toContain("application/json");
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

	test("a redirect to an ungranted host is denied, never followed", async () => {
		let leaked = 0;
		SERVER.use(
			http.get(
				"http://allowed.test/go",
				() =>
					new HttpResponse(null, {
						status: 302,
						headers: { location: "http://evil.test/latest/meta-data" },
					}),
			),
			http.get("http://evil.test/latest/meta-data", () => {
				leaked += 1;
				return HttpResponse.text("top secret");
			}),
		);
		let result = await PLUGIN.call(
			"get",
			[value("http://allowed.test/go")],
			buildContext(allowOnlyHost("allowed.test")),
		);
		let error = unwrapError(result);
		expect(error).toBeInstanceOf(PermissionDeniedError);
		expect(error.code).toBe("permission-denied");
		expect(error.message).toContain("evil.test");
		expect(leaked).toBe(0);
	});

	test("a redirect within the grant is followed to its target", async () => {
		SERVER.use(
			http.get(
				"http://allowed.test/old",
				() => new HttpResponse(null, { status: 301, headers: { location: "/new" } }),
			),
			http.get("http://allowed.test/new", () => HttpResponse.json({ moved: true })),
		);
		let result = await PLUGIN.call(
			"get",
			[value("http://allowed.test/old")],
			buildContext(allowOnlyHost("allowed.test")),
		);
		let data = asObject(unwrap(result));
		expect(data.status).toBe(200);
		expect(data.json).toEqual({ moved: true });
	});

	test("a cross-origin body-preserving redirect strips credential headers", async () => {
		let seen: { auth: string | null; cookie: string | null; trace: string | null } | undefined;
		SERVER.use(
			http.post(
				"http://a.test/start",
				() => new HttpResponse(null, { status: 307, headers: { location: "http://b.test/next" } }),
			),
			http.post("http://b.test/next", ({ request }) => {
				seen = {
					auth: request.headers.get("authorization"),
					cookie: request.headers.get("cookie"),
					trace: request.headers.get("x-trace"),
				};
				return HttpResponse.json({ ok: true });
			}),
		);
		let result = await PLUGIN.call(
			"post",
			[
				value("http://a.test/start"),
				word("headers"),
				value({ authorization: "Bearer secret", cookie: "sid=abc", "x-trace": "keep" }),
			],
			buildContext(),
		);
		expect(isSuccess(result)).toBe(true);
		expect(seen?.auth).toBeNull();
		expect(seen?.cookie).toBeNull();
		expect(seen?.trace).toBe("keep");
	});

	test("a same-origin body-preserving redirect keeps credential headers", async () => {
		let auth: string | null | undefined;
		SERVER.use(
			http.post(
				"http://a.test/start",
				() => new HttpResponse(null, { status: 307, headers: { location: "http://a.test/next" } }),
			),
			http.post("http://a.test/next", ({ request }) => {
				auth = request.headers.get("authorization");
				return HttpResponse.json({ ok: true });
			}),
		);
		let result = await PLUGIN.call(
			"post",
			[value("http://a.test/start"), word("headers"), value({ authorization: "Bearer secret" })],
			buildContext(),
		);
		expect(isSuccess(result)).toBe(true);
		expect(auth).toBe("Bearer secret");
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

	test("rejects a non-string URL argument", async () => {
		let result = await PLUGIN.call("get", [value(42)], buildContext());
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("URL string");
	});

	test("rejects a call with no arguments", async () => {
		let missing = unwrapError(await PLUGIN.call("get", [], buildContext()));
		expect(missing.code).toBe("tool-error");
		expect(missing.message).toContain("no arguments");
	});

	test("an unknown tool is a tool error listing the available tools", async () => {
		let result = await PLUGIN.call("head", [value("https://api.example.com/a")], buildContext());
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("get, post, put, patch, delete");
	});

	test("headers set on the request reach the server", async () => {
		let captured: { auth: string | null } | undefined;
		SERVER.use(
			http.get("https://api.example.com/userinfo", ({ request }) => {
				captured = { auth: request.headers.get("authorization") };
				return HttpResponse.json({ sub: "user-1" });
			}),
		);
		let result = await PLUGIN.call(
			"get",
			[
				value("https://api.example.com/userinfo"),
				word("headers"),
				value({ authorization: "Bearer abc" }),
			],
			buildContext(),
		);
		expect(isSuccess(result)).toBe(true);
		expect(captured?.auth).toBe("Bearer abc");
	});

	test("a form body is sent as application/x-www-form-urlencoded", async () => {
		let captured: { contentType: string | null; body: string } | undefined;
		SERVER.use(
			http.post("https://api.example.com/token", async ({ request }) => {
				captured = {
					contentType: request.headers.get("content-type"),
					body: await request.text(),
				};
				return HttpResponse.json({ ok: true });
			}),
		);
		let result = await PLUGIN.call(
			"post",
			[
				value("https://api.example.com/token"),
				word("form"),
				value({ grant_type: "authorization_code", code: "bogus" }),
			],
			buildContext(),
		);
		expect(isSuccess(result)).toBe(true);
		expect(String(captured?.contentType)).toContain("application/x-www-form-urlencoded");
		let params = new URLSearchParams(captured?.body ?? "");
		expect(params.get("grant_type")).toBe("authorization_code");
		expect(params.get("code")).toBe("bogus");
	});

	test("the json tag sends any value as application/json", async () => {
		SERVER.use(
			http.post("https://api.example.com/j", async ({ request }) =>
				HttpResponse.json({
					contentType: request.headers.get("content-type"),
					received: await request.text(),
				}),
			),
		);
		let result = await PLUGIN.call(
			"post",
			[value("https://api.example.com/j"), word("json"), value("a plain string")],
			buildContext(),
		);
		let json = asObject(asObject(unwrap(result)).json);
		expect(asString(json.contentType)).toContain("application/json");
		expect(json.received).toBe(JSON.stringify("a plain string"));
	});

	test("the text tag sends a string as text/plain", async () => {
		SERVER.use(
			http.post("https://api.example.com/t", async ({ request }) =>
				HttpResponse.json({
					contentType: request.headers.get("content-type"),
					received: await request.text(),
				}),
			),
		);
		let result = await PLUGIN.call(
			"post",
			[value("https://api.example.com/t"), word("text"), value("hi there")],
			buildContext(),
		);
		let json = asObject(asObject(unwrap(result)).json);
		expect(asString(json.contentType)).toContain("text/plain");
		expect(json.received).toBe("hi there");
	});

	test("an explicit headers content-type overrides the body's auto type", async () => {
		let captured: { contentType: string | null } | undefined;
		SERVER.use(
			http.post("https://api.example.com/doc", async ({ request }) => {
				captured = { contentType: request.headers.get("content-type") };
				return HttpResponse.json({ received: await request.json() });
			}),
		);
		let result = await PLUGIN.call(
			"post",
			[
				value("https://api.example.com/doc"),
				value({ name: "Ada" }),
				word("headers"),
				value({ "Content-Type": "application/vnd.api+json" }),
			],
			buildContext(),
		);
		expect(isSuccess(result)).toBe(true);
		expect(captured?.contentType).toBe("application/vnd.api+json");
	});

	test("multiple headers arrive and number/boolean values coerce to strings", async () => {
		let seen: Record<string, string | null> = {};
		SERVER.use(
			http.get("https://api.example.com/multi", ({ request }) => {
				seen = {
					accept: request.headers.get("accept"),
					"x-count": request.headers.get("x-count"),
					"x-debug": request.headers.get("x-debug"),
				};
				return HttpResponse.json({ ok: true });
			}),
		);
		let result = await PLUGIN.call(
			"get",
			[
				value("https://api.example.com/multi"),
				word("headers"),
				value({ accept: "application/json", "x-count": 3, "x-debug": true }),
			],
			buildContext(),
		);
		expect(isSuccess(result)).toBe(true);
		expect(seen.accept).toBe("application/json");
		expect(seen["x-count"]).toBe("3");
		expect(seen["x-debug"]).toBe("true");
	});

	test("a form field value coerces a number to a string", async () => {
		let body = "";
		SERVER.use(
			http.post("https://api.example.com/f", async ({ request }) => {
				body = await request.text();
				return HttpResponse.json({ ok: true });
			}),
		);
		let result = await PLUGIN.call(
			"post",
			[value("https://api.example.com/f"), word("form"), value({ page: 2, active: true })],
			buildContext(),
		);
		expect(isSuccess(result)).toBe(true);
		let params = new URLSearchParams(body);
		expect(params.get("page")).toBe("2");
		expect(params.get("active")).toBe("true");
	});

	test("form and headers combine on one request", async () => {
		let captured: { auth: string | null; contentType: string | null; body: string } | undefined;
		SERVER.use(
			http.post("https://api.example.com/introspect", async ({ request }) => {
				captured = {
					auth: request.headers.get("authorization"),
					contentType: request.headers.get("content-type"),
					body: await request.text(),
				};
				return HttpResponse.json({ active: false });
			}),
		);
		let result = await PLUGIN.call(
			"post",
			[
				value("https://api.example.com/introspect"),
				word("form"),
				value({ token: "abc", token_type_hint: "access_token" }),
				word("headers"),
				value({ authorization: "Basic dXNlcjpwYXNz" }),
			],
			buildContext(),
		);
		expect(isSuccess(result)).toBe(true);
		expect(captured?.auth).toBe("Basic dXNlcjpwYXNz");
		expect(String(captured?.contentType)).toContain("application/x-www-form-urlencoded");
		let params = new URLSearchParams(captured?.body ?? "");
		expect(params.get("token")).toBe("abc");
		expect(params.get("token_type_hint")).toBe("access_token");
	});

	test("two bodies is a tool error naming the conflict", async () => {
		let result = await PLUGIN.call(
			"post",
			[value("https://api.example.com/x"), value({ a: 1 }), word("json"), value({ b: 2 })],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("one request body");
	});

	test("a form body and a text body together is a tool error", async () => {
		let result = await PLUGIN.call(
			"post",
			[
				value("https://api.example.com/x"),
				word("form"),
				value({ a: "1" }),
				word("text"),
				value("hi"),
			],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("one request body");
	});

	test("a tagged body on GET is a tool error naming the method", async () => {
		let result = await PLUGIN.call(
			"get",
			[value("https://api.example.com/x"), word("json"), value({ a: 1 })],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("GET");
	});

	test("a bare body on GET is a tool error naming the method", async () => {
		let result = await PLUGIN.call(
			"get",
			[value("https://api.example.com/x"), value({ a: 1 })],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("GET");
	});

	test("an unknown option word is a tool error listing the option words", async () => {
		let result = await PLUGIN.call(
			"get",
			[value("https://api.example.com/x"), word("query")],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('"query"');
		expect(error.message).toContain("headers, form, json, text, bearer, basic");
	});

	test("an option word missing its value is a tool error", async () => {
		let result = await PLUGIN.call(
			"post",
			[value("https://api.example.com/x"), word("headers")],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("headers");
		expect(error.message).toContain("value");
	});

	test("an option word followed by another word is a tool error", async () => {
		let result = await PLUGIN.call(
			"post",
			[value("https://api.example.com/x"), word("headers"), word("form"), value({ a: "1" })],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("value");
	});

	test("two headers blocks is a tool error", async () => {
		let result = await PLUGIN.call(
			"get",
			[
				value("https://api.example.com/x"),
				word("headers"),
				value({ a: "1" }),
				word("headers"),
				value({ b: "2" }),
			],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("at most one headers");
	});

	test("a non-object headers value is a tool error", async () => {
		let result = await PLUGIN.call(
			"get",
			[value("https://api.example.com/x"), word("headers"), value("nope")],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("object");
	});

	test("a non-scalar header value is a tool error naming the field", async () => {
		let result = await PLUGIN.call(
			"get",
			[value("https://api.example.com/x"), word("headers"), value({ "x-bad": ["a"] })],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain('"x-bad"');
	});

	test("a non-string text body is a tool error", async () => {
		let result = await PLUGIN.call(
			"post",
			[value("https://api.example.com/x"), word("text"), value(42)],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("string");
	});

	test("the bearer option sets an Authorization: Bearer header", async () => {
		let captured: { auth: string | null } | undefined;
		SERVER.use(
			http.get("https://api.example.com/userinfo", ({ request }) => {
				captured = { auth: request.headers.get("authorization") };
				return HttpResponse.json({ sub: "user-1" });
			}),
		);
		let result = await PLUGIN.call(
			"get",
			[value("https://api.example.com/userinfo"), word("bearer"), value("tok-123")],
			buildContext(),
		);
		expect(isSuccess(result)).toBe(true);
		expect(captured?.auth).toBe("Bearer tok-123");
	});

	test("the basic option sets an Authorization: Basic base64(user:pass) header", async () => {
		let captured: { auth: string | null } | undefined;
		SERVER.use(
			http.post("https://api.example.com/introspect", ({ request }) => {
				captured = { auth: request.headers.get("authorization") };
				return HttpResponse.json({ active: true });
			}),
		);
		let result = await PLUGIN.call(
			"post",
			[
				value("https://api.example.com/introspect"),
				word("basic"),
				value("client-id"),
				value("s3cret"),
				word("form"),
				value({ token: "abc" }),
			],
			buildContext(),
		);
		expect(isSuccess(result)).toBe(true);
		expect(captured?.auth).toBe(`Basic ${btoa("client-id:s3cret")}`);
	});

	test("basic combines with a form body on the same request", async () => {
		let captured: { auth: string | null; body: string } | undefined;
		SERVER.use(
			http.post("https://api.example.com/token", async ({ request }) => {
				captured = { auth: request.headers.get("authorization"), body: await request.text() };
				return HttpResponse.json({ ok: true });
			}),
		);
		let result = await PLUGIN.call(
			"post",
			[
				value("https://api.example.com/token"),
				word("basic"),
				value("id"),
				value("secret"),
				word("form"),
				value({ grant_type: "client_credentials" }),
			],
			buildContext(),
		);
		expect(isSuccess(result)).toBe(true);
		expect(captured?.auth).toBe(`Basic ${btoa("id:secret")}`);
		expect(new URLSearchParams(captured?.body ?? "").get("grant_type")).toBe("client_credentials");
	});

	test("an explicit headers authorization overrides bearer", async () => {
		let captured: { auth: string | null } | undefined;
		SERVER.use(
			http.get("https://api.example.com/u", ({ request }) => {
				captured = { auth: request.headers.get("authorization") };
				return HttpResponse.json({ ok: true });
			}),
		);
		let result = await PLUGIN.call(
			"get",
			[
				value("https://api.example.com/u"),
				word("bearer"),
				value("from-bearer"),
				word("headers"),
				value({ authorization: "Bearer from-headers" }),
			],
			buildContext(),
		);
		expect(isSuccess(result)).toBe(true);
		expect(captured?.auth).toBe("Bearer from-headers");
	});

	test("bearer and basic together is a tool error", async () => {
		let result = await PLUGIN.call(
			"post",
			[
				value("https://api.example.com/x"),
				word("bearer"),
				value("tok"),
				word("basic"),
				value("id"),
				value("secret"),
			],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message.toLowerCase()).toContain("auth");
	});

	test("a repeated bearer option is a tool error", async () => {
		let result = await PLUGIN.call(
			"get",
			[value("https://api.example.com/x"), word("bearer"), value("a"), word("bearer"), value("b")],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message.toLowerCase()).toContain("auth");
	});

	test("bearer with a non-string token is a tool error", async () => {
		let result = await PLUGIN.call(
			"get",
			[value("https://api.example.com/x"), word("bearer"), value(42)],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
	});

	test("bearer missing its token is a tool error", async () => {
		let result = await PLUGIN.call(
			"get",
			[value("https://api.example.com/x"), word("bearer")],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("bearer");
	});

	test("basic missing its password is a tool error", async () => {
		let result = await PLUGIN.call(
			"post",
			[value("https://api.example.com/x"), word("basic"), value("only-user")],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
		expect(error.message).toContain("basic");
	});

	test("basic with a non-Latin1 credential is a tool error, not a throw", async () => {
		let result = await PLUGIN.call(
			"post",
			[value("https://api.example.com/x"), word("basic"), value("user"), value("pass\u{1F600}")],
			buildContext(),
		);
		let error = unwrapError(result);
		expect(error.code).toBe("tool-error");
	});
});
