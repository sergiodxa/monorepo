/**
 * Tests the registration contract: the request is counted before the handler runs,
 * the response says what the quota was, a denied request never reaches the handler,
 * two registrations never share a counter, and an outage does not lock clients out.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, setSystemTime, test } from "bun:test";

import { failure, success } from "@pkg/result";
import { RequestContext } from "remix/fetch-router";

import type { RateLimitLogger } from "./middleware";
import type { Adapter, RateLimitDecision } from "./types";

import { MemoryAdapter } from "./memory";
import { rateLimit } from "./middleware";
import { RateLimitError } from "./rate-limit-error";

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
		async next() {
			calls += 1;
			return new Response("handler body");
		},
	};
}

/** Collects the events a middleware logs, standing in for the app's request logger. */
function createLogger() {
	let events: { event: string; payload?: Record<string, unknown> }[] = [];
	let logger: RateLimitLogger = {
		info(event, payload) {
			events.push({ event, payload });
		},
		error(event, payload) {
			events.push({ event, payload });
		},
	};
	return { logger, events };
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
	setSystemTime();
});

describe("rateLimit middleware", () => {
	test("annotates an allowed response with the quota it saw", async () => {
		setSystemTime(new Date(WINDOW_START + 3000));
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
		setSystemTime(new Date(WINDOW_START + 3000));
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
		setSystemTime(new Date(WINDOW_START));
		let middleware = rateLimit({ adapter: new MemoryAdapter({ limit: 1, window: "10 seconds" }) });

		let first = await middleware(createClientContext("198.51.100.1"), async () => new Response());
		let second = await middleware(createClientContext("198.51.100.2"), async () => new Response());
		let third = await middleware(createClientContext("198.51.100.1"), async () => new Response());

		expect(first.status).toBe(200);
		expect(second.status).toBe(200);
		expect(third.status).toBe(429);
	});

	test("still limits a request that carries no client address", async () => {
		setSystemTime(new Date(WINDOW_START));
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
		setSystemTime(new Date(WINDOW_START));
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
		setSystemTime(new Date(WINDOW_START + 3000));
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
		let { logger, events } = createLogger();
		let middleware = rateLimit({ adapter: createFailingAdapter(), logger: () => logger });
		let handler = createHandler();

		let response = await middleware(createClientContext(), handler.next);

		expect(handler.calls).toBe(1);
		expect(response.status).toBe(200);
		expect(response.headers.get("RateLimit")).toBeNull();
		expect(events[0]?.event).toBe("rate_limit.unavailable");
		expect(events[0]?.payload).toMatchObject({ policy: "open", backend: "kv" });
	});

	test("fails closed when the registration asks for it", async () => {
		let { logger, events } = createLogger();
		let middleware = rateLimit({
			adapter: createFailingAdapter(),
			failurePolicy: "closed",
			logger: () => logger,
		});
		let handler = createHandler();

		let response = await middleware(createClientContext(), handler.next);

		expect(handler.calls).toBe(0);
		expect(response.status).toBe(429);
		expect(response.headers.get("RateLimit")).toBeNull();
		expect(response.headers.get("Retry-After")).toBeNull();
		expect(events[0]?.payload).toMatchObject({ policy: "closed" });
	});

	test("logs a denied attempt at info level", async () => {
		setSystemTime(new Date(WINDOW_START));
		let { logger, events } = createLogger();
		let middleware = rateLimit({
			adapter: new MemoryAdapter({ limit: 1, window: "10 seconds" }),
			prefix: "login",
			logger: () => logger,
		});

		await middleware(createClientContext(), async () => new Response());
		await middleware(createClientContext(), async () => new Response());

		expect(events).toHaveLength(1);
		expect(events[0]?.event).toBe("rate_limit.exceeded");
		expect(events[0]?.payload).toMatchObject({ key: `login:${CLIENT_IP}`, limit: 1 });
	});

	test("falls back to the logger the app installed on the context", async () => {
		let { logger, events } = createLogger();
		let middleware = rateLimit({ adapter: createFailingAdapter() });
		let context = Object.assign(createClientContext(), { logger });

		await middleware(context, async () => new Response());

		expect(events[0]?.event).toBe("rate_limit.unavailable");
	});

	test("runs without a logger, rather than throwing", async () => {
		let middleware = rateLimit({ adapter: createFailingAdapter() });

		let response = await middleware(createClientContext(), async () => new Response("ok"));

		expect(response.status).toBe(200);
	});
});
