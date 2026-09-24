/**
 * Tests each branch of the middleware against the in-memory store: pass-through, the
 * missing and invalid key refusals, replay, the in-flight and reused refusals, which
 * outcomes release the key, scope isolation, lease takeover and store outages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Log } from "@sdxc/logger";
import { defineProblems } from "@sdxc/problem";
import { failure } from "@sdxc/result";
import { RequestContext } from "remix/router";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { IdempotencyOptions } from "./middleware.js";
import type { IdempotencyStore } from "./types.js";

import { IdempotencyStoreError } from "./errors.js";
import { MemoryStore } from "./memory.js";
import { idempotency } from "./middleware.js";
import { IDEMPOTENCY_PROBLEM_ENTRIES } from "./problems.js";

/** The instant time-sensitive cases start at. */
const NOW = 1_700_000_000_000;

/** The endpoint every case posts to. */
const URL = "https://api.example.com/monitors";

interface Call {
	method?: string;
	key?: string | null;
	body?: string;
	url?: string;
	caller?: string;
}

/**
 * A context for one request, carrying the caller the scope reads in a header.
 *
 * @param call - What the request carries; a key of `null` sends no header
 */
function contextOf(call: Call = {}): RequestContext {
	let headers = new Headers({
		"Content-Type": "application/json",
		"X-Caller": call.caller ?? "c1",
	});
	let key = call.key === undefined ? '"key-1"' : call.key;
	if (key !== null) headers.set("Idempotency-Key", key);
	let method = call.method ?? "POST";
	let body = method === "GET" ? undefined : (call.body ?? '{"url":"https://example.com"}');
	return new RequestContext(new Request(call.url ?? URL, { method, headers, body }));
}

/**
 * A handler that counts its runs and answers with whatever `respond` builds.
 *
 * @param respond - The response for each run, given the run's number from 1
 */
function handler(
	respond: (run: number) => Response | Promise<Response> = (run) =>
		Response.json({ id: run }, { status: 201, headers: { Location: `/monitors/${run}` } }),
) {
	let runs = 0;
	return {
		get runs() {
			return runs;
		},
		next: async () => {
			runs += 1;
			return await respond(runs);
		},
	};
}

/**
 * The middleware over a fresh in-memory store, scoped by the `X-Caller` header.
 *
 * @param options - Options a case overrides
 */
function setup(options: Partial<IdempotencyOptions> = {}) {
	let store = new MemoryStore();
	let middleware = idempotency({
		store,
		scope: (context) => context.request.headers.get("X-Caller") ?? "anonymous",
		ttl: "1 hour",
		...options,
	});
	return { store, middleware };
}

/** A store whose every call fails, standing in for an unreachable database. */
function brokenStore(): IdempotencyStore {
	let error = () => Promise.resolve(failure(new IdempotencyStoreError("unreachable")));
	return { claim: error, complete: error, release: error };
}

afterEach(() => {
	vi.useRealTimers();
});

describe("idempotency middleware", () => {
	test("passes a GET through untouched", async () => {
		let { middleware } = setup({ required: true });
		let run = handler(() => new Response("list"));

		let response = await middleware(contextOf({ method: "GET" }), run.next);

		expect(await response.text()).toBe("list");
		expect(run.runs).toBe(1);
	});

	test("passes a request without a key through when the key is optional", async () => {
		let { middleware } = setup();
		let run = handler();

		await middleware(contextOf({ key: null }), run.next);
		await middleware(contextOf({ key: null }), run.next);

		expect(run.runs).toBe(2);
	});

	test("answers 400 for a missing key when the key is required", async () => {
		let { middleware } = setup({ required: true });
		let run = handler();

		let response = await middleware(contextOf({ key: null }), run.next);

		expect(response.status).toBe(400);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
		expect(await response.json()).toMatchObject({ type: "about:blank", status: 400 });
		expect(run.runs).toBe(0);
	});

	test("answers 400 for an unquoted key, saying how to quote it", async () => {
		let { middleware } = setup();
		let run = handler();

		let response = await middleware(contextOf({ key: "key-1" }), run.next);

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ detail: expect.stringMatching(/quoted/) });
		expect(run.runs).toBe(0);
	});

	test("answers 400 for a key over the length bound", async () => {
		let { middleware } = setup();
		let response = await middleware(contextOf({ key: `"${"k".repeat(256)}"` }), handler().next);
		expect(response.status).toBe(400);
	});

	test("replays the first outcome for a retry, without running the handler again", async () => {
		let { middleware } = setup();
		let run = handler(
			() =>
				new Response('{"id":1}', {
					status: 201,
					headers: {
						"Content-Type": "application/json",
						Location: "/monitors/1",
						"Set-Cookie": "session=abc",
					},
				}),
		);

		let first = await middleware(contextOf(), run.next);
		let second = await middleware(contextOf(), run.next);

		expect(run.runs).toBe(1);
		expect(first.status).toBe(201);
		expect(first.headers.get("Set-Cookie")).toBe("session=abc");
		expect(await first.text()).toBe('{"id":1}');

		expect(second.status).toBe(201);
		expect(second.headers.get("Location")).toBe("/monitors/1");
		expect(second.headers.get("Content-Type")).toBe("application/json");
		expect(second.headers.get("Set-Cookie")).toBeNull();
		expect(await second.text()).toBe('{"id":1}');
	});

	test("replays binary bodies byte for byte", async () => {
		let bytes = new Uint8Array([0, 255, 128, 10, 13]);
		let { middleware } = setup();
		let run = handler(() => new Response(bytes, { status: 200 }));

		await middleware(contextOf(), run.next);
		let replay = await middleware(contextOf(), run.next);

		expect(new Uint8Array(await replay.arrayBuffer())).toEqual(bytes);
	});

	test("replays a response that has no body", async () => {
		let { middleware } = setup();
		let run = handler(() => new Response(null, { status: 204 }));

		await middleware(contextOf(), run.next);
		let replay = await middleware(contextOf(), run.next);

		expect(run.runs).toBe(1);
		expect(replay.status).toBe(204);
		expect(replay.body).toBeNull();
	});

	test("applies to PATCH, however its method is cased", async () => {
		let { middleware } = setup();
		let run = handler();

		await middleware(contextOf({ method: "patch" }), run.next);
		await middleware(contextOf({ method: "patch" }), run.next);

		expect(run.runs).toBe(1);
	});

	test("answers 409 with Retry-After while the first request is in flight", async () => {
		let { middleware } = setup();
		let release!: () => void;
		let gate = new Promise<void>((resolve) => (release = resolve));
		let run = handler(async () => {
			await gate;
			return new Response("done", { status: 201 });
		});

		let first = middleware(contextOf(), run.next);
		await vi.waitFor(() => expect(run.runs).toBe(1));
		let second = await middleware(contextOf(), run.next);

		expect(second.status).toBe(409);
		expect(second.headers.get("Retry-After")).toBe("1");
		release();
		expect((await first).status).toBe(201);
		expect(run.runs).toBe(1);
	});

	test("answers 422 when the key is reused with a different payload", async () => {
		let { middleware } = setup();
		let run = handler();

		await middleware(contextOf({ body: '{"url":"https://a.example"}' }), run.next);
		let reused = await middleware(contextOf({ body: '{"url":"https://b.example"}' }), run.next);

		expect(reused.status).toBe(422);
		expect(run.runs).toBe(1);
	});

	test("compares keys alone when the fingerprint is off", async () => {
		let { middleware } = setup({ fingerprint: false });
		let run = handler();

		await middleware(contextOf({ body: '{"url":"https://a.example"}' }), run.next);
		let replay = await middleware(contextOf({ body: '{"url":"https://b.example"}' }), run.next);

		expect(replay.status).toBe(201);
		expect(run.runs).toBe(1);
	});

	test("uses a caller's fingerprint", async () => {
		let { middleware } = setup({ fingerprint: async () => "constant" });
		let run = handler();

		await middleware(contextOf({ body: "a" }), run.next);
		await middleware(contextOf({ body: "b" }), run.next);

		expect(run.runs).toBe(1);
	});

	test("leaves the request body readable by the handler", async () => {
		let { middleware } = setup();
		let context = contextOf({ body: '{"name":"api"}' });

		let response = await middleware(context, async () =>
			Response.json(await context.request.json()),
		);

		expect(await response.json()).toEqual({ name: "api" });
	});

	test("keeps callers apart: one caller's key never replays another's response", async () => {
		let { middleware } = setup();
		let run = handler();

		await middleware(contextOf({ caller: "alice" }), run.next);
		let other = await middleware(contextOf({ caller: "bob" }), run.next);

		expect(run.runs).toBe(2);
		expect(await other.json()).toEqual({ id: 2 });
	});

	test("keeps paths apart under one key", async () => {
		let { middleware } = setup();
		let run = handler();

		await middleware(contextOf({ url: "https://api.example.com/monitors" }), run.next);
		await middleware(contextOf({ url: "https://api.example.com/alerts" }), run.next);

		expect(run.runs).toBe(2);
	});

	test("releases the key after a server error so a retry runs again", async () => {
		let { middleware } = setup();
		let run = handler((n) => new Response(null, { status: n === 1 ? 500 : 201 }));

		expect((await middleware(contextOf(), run.next)).status).toBe(500);
		expect((await middleware(contextOf(), run.next)).status).toBe(201);
		expect((await middleware(contextOf(), run.next)).status).toBe(201);
		expect(run.runs).toBe(2);
	});

	test("stores what shouldStore accepts", async () => {
		let { middleware } = setup({ shouldStore: (response) => response.status !== 503 });
		let run = handler(() => new Response("saved, not read back", { status: 500 }));

		await middleware(contextOf(), run.next);
		let replay = await middleware(contextOf(), run.next);

		expect(run.runs).toBe(1);
		expect(await replay.text()).toBe("saved, not read back");
	});

	test("releases the key for a body over maxBodyBytes, still returning it whole", async () => {
		let { middleware } = setup({ maxBodyBytes: 4 });
		let run = handler(() => new Response("12345", { status: 201 }));

		let first = await middleware(contextOf(), run.next);
		await middleware(contextOf(), run.next);

		expect(await first.text()).toBe("12345");
		expect(run.runs).toBe(2);
	});

	test("releases the key when the handler throws, and rethrows", async () => {
		let { middleware } = setup();
		let run = handler((n) => {
			if (n === 1) throw new Error("boom");
			return new Response("ok", { status: 201 });
		});

		await expect(middleware(contextOf(), run.next)).rejects.toThrow("boom");
		expect((await middleware(contextOf(), run.next)).status).toBe(201);
	});

	test("takes over a claim whose lease ran out", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(NOW);
		let { middleware } = setup({ lease: "10 seconds" });
		let hang = handler(() => new Promise<Response>(() => {}));
		void middleware(contextOf(), hang.next);
		await vi.waitFor(() => expect(hang.runs).toBe(1));

		vi.setSystemTime(NOW + 5_000);
		expect((await middleware(contextOf(), handler().next)).status).toBe(409);

		vi.setSystemTime(NOW + 11_000);
		expect((await middleware(contextOf(), handler().next)).status).toBe(201);
	});

	test("expires a stored outcome after the ttl", async () => {
		vi.useFakeTimers({ toFake: ["Date"] });
		vi.setSystemTime(NOW);
		let { middleware } = setup({ ttl: "1 minute" });
		let run = handler();

		await middleware(contextOf(), run.next);
		vi.setSystemTime(NOW + 59_999);
		await middleware(contextOf(), run.next);
		vi.setSystemTime(NOW + 60_000);
		await middleware(contextOf(), run.next);

		expect(run.runs).toBe(2);
	});

	test("reads a per-request store off the context", async () => {
		let store = new MemoryStore();
		let seen: RequestContext[] = [];
		let { middleware } = setup({
			store: (context) => {
				seen.push(context);
				return store;
			},
		});
		let context = contextOf();

		await middleware(context, handler().next);

		expect(seen).toEqual([context]);
	});

	test("answers 503 when the store is unreachable under the closed policy", async () => {
		let { middleware } = setup({ store: brokenStore() });
		let run = handler();

		let response = await middleware(contextOf(), run.next);

		expect(response.status).toBe(503);
		expect(response.headers.get("Content-Type")).toBe("application/problem+json");
		expect(run.runs).toBe(0);
	});

	test("runs the handler unprotected when the store is unreachable under the open policy", async () => {
		let { middleware } = setup({ store: brokenStore(), failurePolicy: "open" });
		let run = handler();

		let response = await middleware(contextOf(), run.next);

		expect(response.status).toBe(201);
		expect(run.runs).toBe(1);
	});

	test("answers with the app's own catalog", async () => {
		let problems = defineProblems("https://docs.example.com/errors/", {
			...IDEMPOTENCY_PROBLEM_ENTRIES,
		});
		let { middleware } = setup({ problems, required: true });

		let missing = await middleware(contextOf({ key: null }), handler().next);
		expect(await missing.json()).toMatchObject({
			type: "https://docs.example.com/errors/idempotency-key-missing",
			status: 400,
		});

		let release!: () => void;
		let gate = new Promise<void>((resolve) => (release = resolve));
		let slow = handler(async () => {
			await gate;
			return new Response("done");
		});
		let first = middleware(contextOf(), slow.next);
		await vi.waitFor(() => expect(slow.runs).toBe(1));
		let inUse = await middleware(contextOf(), slow.next);
		expect(inUse.headers.get("Retry-After")).toBe("1");
		expect(await inUse.json()).toMatchObject({
			type: "https://docs.example.com/errors/idempotency-key-in-use",
			status: 409,
		});
		release();
		await first;
	});

	test("logs a replay without the key or the scope", async () => {
		let records: Record<string, unknown>[] = [];
		let log = new Log({ kind: "request", sink: (record) => void records.push(record) });
		let { middleware } = setup();
		let run = handler();

		await middleware(contextOf({ key: '"secret-key"', caller: "secret-caller" }), run.next);
		await log.run(() =>
			middleware(contextOf({ key: '"secret-key"', caller: "secret-caller" }), run.next),
		);

		let text = JSON.stringify(records);
		expect(text).toContain("idempotency.replayed");
		expect(text).not.toContain("secret-key");
		expect(text).not.toContain("secret-caller");
	});
});
