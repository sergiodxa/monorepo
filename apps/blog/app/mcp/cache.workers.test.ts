/**
 * Tests the MCP cache against a real KV namespace.
 *
 * In the Workers pool, so `CACHE` is Cloudflare's own implementation. That matters because
 * the thing being asserted is that a value written under a key is found again under the
 * same key — a guarantee only the real implementation can confirm.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CallToolResult, ToolContext } from "@sdxc/mcp";

import { env } from "cloudflare:test";
import { asyncContext } from "remix/middleware/async-context";
import { createRouter } from "remix/router";
import { beforeEach, describe, expect, test } from "vitest";

import createEnvMiddleware from "~/app/http/middleware/env";

import { cached, cacheToolResults } from "./cache";

/** Deferred writes the cache handed to `waitUntil`, awaited before asserting a hit. */
let deferred: Array<Promise<unknown>> = [];

/** A full `App.Env` over the real bindings; only the cache and `waitUntil` are read here. */
function environment(): App.Env {
	return {
		IS_PROD: false,
		CLIENT_ID: "test",
		CLIENT_SECRET: "test",
		COOKIE_SESSION_SECRET: "test",
		AUTH: env.AUTH,
		REDIRECTS: env.REDIRECTS,
		CACHE: env.CACHE,
		MCP_RATE_LIMITER: undefined,
		waitUntil: (promise) => deferred.push(promise),
	};
}

/**
 * Runs `body` inside a request whose context carries the environment.
 *
 * The cache reads its binding through `getEnv`, so it needs both the env middleware and the
 * async context the production chain gives it.
 */
async function inRequest<T>(body: () => T | Promise<T>): Promise<T> {
	let captured: T | undefined;
	let router = createRouter({ middleware: [createEnvMiddleware(environment()), asyncContext()] });

	router.get("/", async () => {
		captured = await body();
		return new Response("ok");
	});

	await router.fetch(new Request("https://blog.test/"));
	await Promise.all(deferred);

	if (captured === undefined) throw new Error("the body did not run");
	return captured;
}

/** A tool context carrying just the fields the cache middleware reads. */
function toolContext(name: string, input: Record<string, unknown>): ToolContext {
	return {
		tool: { name, description: "", inputSchema: { type: "object", properties: {} } },
		input,
	} as ToolContext;
}

/** KV persists across tests in this pool, so each case must start from a clean slate. */
beforeEach(async () => {
	deferred = [];
	for (let key of (await env.CACHE.list({ prefix: "mcp:" })).keys) await env.CACHE.delete(key.name);
});

describe("cached", () => {
	test("computes on a miss and serves the stored value after it", async () => {
		let calls = 0;
		let produce = async () => {
			calls += 1;
			return { value: calls };
		};

		let first = await inRequest(() => cached("test", { id: 1 }, produce));
		let second = await inRequest(() => cached("test", { id: 1 }, produce));

		expect(first).toEqual({ value: 1 });
		expect(second).toEqual({ value: 1 });
		expect(calls).toBe(1);
	});

	test("keys on the value, so a different argument is a different entry", async () => {
		let seen: Array<unknown> = [];
		let produce = (id: number) => async () => {
			seen.push(id);
			return { id };
		};

		await inRequest(() => cached("test", { id: 1 }, produce(1)));
		await inRequest(() => cached("test", { id: 2 }, produce(2)));

		expect(seen).toEqual([1, 2]);
	});

	test("caches a null result, since not-found is an answer too", async () => {
		let calls = 0;
		let produce = async () => {
			calls += 1;
			return null;
		};

		expect(await inRequest(() => cached("test", null, produce))).toBeNull();
		expect(await inRequest(() => cached("test", null, produce))).toBeNull();
		expect(calls).toBe(1);
	});
});

describe("cacheToolResults", () => {
	/** Runs the middleware over a handler that counts how often it was reached. */
	async function call(input: Record<string, unknown>, counter: { calls: number }) {
		let middleware = cacheToolResults();
		let result: CallToolResult = { content: [{ type: "text", text: "answer" }] };

		return inRequest(() =>
			middleware(toolContext("list_posts", input), async () => {
				counter.calls += 1;
				return result;
			}),
		);
	}

	test("serves a stored result rather than running the tool again", async () => {
		let counter = { calls: 0 };

		let first = await call({ limit: 5 }, counter);
		let second = await call({ limit: 5 }, counter);

		expect(second).toEqual(first);
		expect(counter.calls).toBe(1);
	});

	test("treats different arguments as different calls", async () => {
		let counter = { calls: 0 };

		await call({ limit: 5 }, counter);
		await call({ limit: 10 }, counter);

		expect(counter.calls).toBe(2);
	});

	test("never caches a failed call", async () => {
		let calls = 0;
		let middleware = cacheToolResults();
		let failing = async (): Promise<CallToolResult> => {
			calls += 1;
			return { content: [{ type: "text", text: "no such post" }], isError: true };
		};

		await inRequest(() => middleware(toolContext("get_post", { slug: "nope" }), failing));
		await inRequest(() => middleware(toolContext("get_post", { slug: "nope" }), failing));

		expect(calls).toBe(2);
	});
});
