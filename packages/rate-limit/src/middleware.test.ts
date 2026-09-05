/**
 * Tests the registration contract: the request is counted before the handler runs,
 * the response says what the quota was, a denied request stops before reaching the
 * handler, each registration keeps its own counter, and traffic keeps flowing through
 * an outage.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Log } from "@sdxc/logger";
import { failure, success } from "@sdxc/result";
import { RequestContext } from "remix/router";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Adapter, RateLimitDecision } from "./types.js";

import { MemoryAdapter } from "./memory.js";
import { rateLimit } from "./middleware.js";
import { RateLimitError } from "./rate-limit-error.js";

/** An instant aligned to a 10 second window, so a case starts at a boundary. */
const WINDOW_START = 1_700_000_000_000;

/** The client address the default key derivation reads. */
const CLIENT_IP = "203.0.113.7";

/** Builds a request context, the object a middleware receives. */
function createContext(headers: Record<string, string> = {}): RequestContext {
	return new RequestContext(new Request("https://example.com/token", { method: "POST", headers }));
}

/** Builds a context carrying a client address, as Cloudflare would. */
function createClientContext(ip: string = CLIENT_IP): RequestContext {
	return createContext({ "CF-Connecting-IP": ip });
}

/** A handler that records whether it ran, so a bypass can be told from a denial. */
function createHandler() {
	let calls = 0;
	return {
		get calls() {
			return calls;
		},
		next: async () => {
			calls += 1;
			return new Response("handler body");
		},
	};
}

/**
 * Runs the middleware under a log of its own, so a test reads what it recorded off the
 * emitted record rather than through a logger it installed.
 */
async function recorded(
	fn: () => Response | Promise<Response>,
): Promise<{ response: Response; record: Record<string, unknown> }> {
	let records: Record<string, unknown>[] = [];
	let log = new Log({ kind: "request", sink: (record) => void records.push(record) });
	let response = await log.run(fn);
	return { response, record: records[0] ?? {} };
}

/** The notes the record carries, which is where a middleware's narrative lands. */
function notesOf(record: Record<string, unknown>): Log.Note[] {
	return (record.notes ?? []) as Log.Note[];
}

/** An adapter that records the keys and costs it was asked to spend. */
function createRecordingAdapter(): Adapter & { calls: { key: string; cost?: number }[] } {
	let calls: { key: string; cost?: number }[] = [];
	let decision: RateLimitDecision = {
		allowed: true,
		limit: 10,
		remaining: 9,
		reset: new Date(WINDOW_START + 10_000),
		retryAfter: 10,
	};

	return {
		calls,
		limit: 10,
		window: "10 seconds",
		async consume(key, cost) {
			calls.push({ key, cost });
			return success(decision);
		},
		async reset() {
			return success(undefined);
		},
	};
}

/** An adapter whose backend is down, so every attempt reports a failure. */
function createFailingAdapter(): Adapter {
	return {
		limit: 10,
		window: "10 seconds",
		async consume(key) {
			return failure(
				new RateLimitError("backend unavailable", { backend: "kv", key, cause: new Error("boom") }),
			);
		},
		async reset(key) {
			return failure(new RateLimitError("backend unavailable", { backend: "kv", key }));
		},
	};
}

afterEach(() => {
	vi.useRealTimers();
});

describe("rateLimit middleware", () => {
	test("annotates an allowed response with the quota it saw", async () => {
		vi.setSystemTime(new Date(WINDOW_START + 3000));
		let middleware = rateLimit({ adapter: new MemoryAdapter({ limit: 10, window: "10 seconds" }) });

		let response = await middleware(
			createClientContext(),
			async () => new Response("handler body"),
		);

		expect(response.status).toBe(200);
		expect(await response.text()).toBe("handler body");
		expect(response.headers.get("RateLimit")).toBe("limit=10, remaining=9, reset=7");
		expect(response.headers.get("RateLimit-Policy")).toBe("10;w=10");
		expect(response.headers.get("Retry-After")).toBeNull();
	});

	test("answers a denied request with 429, Retry-After, and the error body", async () => {
		vi.setSystemTime(new Date(WINDOW_START + 3000));
		let middleware = rateLimit({ adapter: new MemoryAdapter({ limit: 1, window: "10 seconds" }) });
		let handler = createHandler();

		await middleware(createClientContext(), handler.next);
		let response = await middleware(createClientContext(), handler.next);

		expect(response.status).toBe(429);
		expect(response.headers.get("Retry-After")).toBe("7");
		expect(response.headers.get("RateLimit")).toBe("limit=1, remaining=0, reset=7");
		expect(await response.json()).toEqual({
			error: "too_many_requests",
			error_description: "Rate limit exceeded. Please try again later.",
		});
		expect(handler.calls).toBe(1);
	});

	test("limits by client address by default", async () => {
		vi.setSystemTime(new Date(WINDOW_START));
		let middleware = rateLimit({ adapter: new MemoryAdapter({ limit: 1, window: "10 seconds" }) });

		let first = await middleware(createClientContext("198.51.100.1"), async () => new Response());
		let second = await middleware(createClientContext("198.51.100.2"), async () => new Response());
		let third = await middleware(createClientContext("198.51.100.1"), async () => new Response());

		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		expect(third.status).toBe(429);
	});

	test("still limits a request that carries no client address", async () => {
		vi.setSystemTime(new Date(WINDOW_START));
		let adapter = createRecordingAdapter();
		let middleware = rateLimit({ adapter, prefix: "token" });

		await middleware(createContext(), async () => new Response());

		expect(adapter.calls[0]?.key).toBe("token:unknown");
	});

	test("derives the key from the options when one is given", async () => {
		let adapter = createRecordingAdapter();
		let middleware = rateLimit({
			adapter,
			prefix: "token",
			key: (context) => context.url.pathname,
		});

		await middleware(createClientContext(), async () => new Response());

		expect(adapter.calls[0]?.key).toBe("token:/token");
	});

	test("prefixes keys per registration, so two limiters cannot collide", async () => {
		vi.setSystemTime(new Date(WINDOW_START));
		let adapter = new MemoryAdapter({ limit: 1, window: "10 seconds" });
		let first = rateLimit({ adapter });
		let second = rateLimit({ adapter });

		let firstResponse = await first(createClientContext(), async () => new Response());
		let secondResponse = await second(createClientContext(), async () => new Response());
		let firstAgain = await first(createClientContext(), async () => new Response());

		expect(firstResponse.status).toBe(200);
		expect(secondResponse.status).toBe(200);
		expect(firstAgain.status).toBe(429);
	});

	test("namespaces keys with an explicit prefix", async () => {
		let adapter = createRecordingAdapter();
		let middleware = rateLimit({ adapter, prefix: "login", key: () => "client-1" });

		await middleware(createClientContext(), async () => new Response());

		expect(adapter.calls[0]?.key).toBe("login:client-1");
	});

	test("spends the configured cost, as a number or a function", async () => {
		let fixed = createRecordingAdapter();
		let computed = createRecordingAdapter();

		await rateLimit({ adapter: fixed, cost: 5 })(createClientContext(), async () => new Response());
		await rateLimit({ adapter: computed, cost: (context) => context.url.pathname.length })(
			createClientContext(),
			async () => new Response(),
		);

		expect(fixed.calls[0]?.cost).toBe(5);
		expect(computed.calls[0]?.cost).toBe(6);
	});

	test("skip bypasses the limiter entirely", async () => {
		let adapter = createRecordingAdapter();
		let middleware = rateLimit({ adapter, skip: () => true });
		let handler = createHandler();

		let response = await middleware(createClientContext(), handler.next);

		expect(handler.calls).toBe(1);
		expect(adapter.calls).toHaveLength(0);
		expect(response.headers.get("RateLimit")).toBeNull();
	});

	test("skip receives the context, so it can bypass selectively", async () => {
		let adapter = createRecordingAdapter();
		let middleware = rateLimit({
			adapter,
			skip: (context) => context.url.pathname === "/health",
		});

		await middleware(createClientContext(), async () => new Response());

		expect(adapter.calls).toHaveLength(1);
	});

	test("onLimit replaces the denied response, keeping the rate limit headers", async () => {
		vi.setSystemTime(new Date(WINDOW_START + 3000));
		let decisions: RateLimitDecision[] = [];
		let middleware = rateLimit({
			adapter: new MemoryAdapter({ limit: 1, window: "10 seconds" }),
			onLimit(_context, decision) {
				decisions.push(decision);
				return new Response("<p>slow down</p>", {
					status: 429,
					headers: { "Content-Type": "text/html" },
				});
			},
		});

		await middleware(createClientContext(), async () => new Response());
		let response = await middleware(createClientContext(), async () => new Response());

		expect(response.headers.get("Content-Type")).toBe("text/html");
		expect(await response.text()).toBe("<p>slow down</p>");
		expect(response.headers.get("Retry-After")).toBe("7");
		expect(decisions[0]?.allowed).toBe(false);
	});

	test("fails open when the backend cannot answer, and logs it", async () => {
		let middleware = rateLimit({ adapter: createFailingAdapter() });
		let handler = createHandler();

		let { response, record } = await recorded(() =>
			middleware(createClientContext(), handler.next),
		);

		expect(handler.calls).toBe(1);
		expect(response.status).toBe(200);
		expect(response.headers.get("RateLimit")).toBeNull();
		expect(notesOf(record)[0]).toMatchObject({
			name: "rate_limit.unavailable",
			policy: "open",
			backend: "kv",
		});
	});

	test("fails closed when the registration asks for it", async () => {
		let middleware = rateLimit({ adapter: createFailingAdapter(), failurePolicy: "closed" });
		let handler = createHandler();

		let { response, record } = await recorded(() =>
			middleware(createClientContext(), handler.next),
		);

		expect(handler.calls).toBe(0);
		expect(response.status).toBe(429);
		expect(response.headers.get("RateLimit")).toBeNull();
		expect(response.headers.get("Retry-After")).toBeNull();
		expect(record).toMatchObject({ outcome: "error", "rate_limit.policy": "closed" });
	});

	test("records a denied attempt as a degraded outcome, with the limit as a field", async () => {
		vi.setSystemTime(new Date(WINDOW_START));
		let middleware = rateLimit({
			adapter: new MemoryAdapter({ limit: 1, window: "10 seconds" }),
			prefix: "login",
		});

		let allowed = await recorded(() =>
			middleware(createClientContext(), async () => new Response()),
		);
		let denied = await recorded(() =>
			middleware(createClientContext(), async () => new Response()),
		);

		expect(notesOf(allowed.record)).toHaveLength(0);
		expect(allowed.record).toMatchObject({ "rate_limit.limit": 1, outcome: "ok" });
		expect(denied.record).toMatchObject({ "rate_limit.limited": true, outcome: "degraded" });
		expect(notesOf(denied.record)[0]).toMatchObject({ name: "rate_limit.exceeded", limit: 1 });
	});

	test("runs with no log open, rather than throwing", async () => {
		let middleware = rateLimit({ adapter: createFailingAdapter() });

		let response = await middleware(createClientContext(), async () => new Response("ok"));

		expect(response.status).toBe(200);
	});
});
