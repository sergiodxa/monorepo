/**
 * Covers the cache middleware: declaration recording and tag accumulation, the
 * headers written onto the finished response, every row of the refusal table
 * including the development throw, what each path records on the invocation's
 * log, and the awaited and deferred purge paths through a recording cache double.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext as Context } from "remix/router";

import { Log } from "@sdxc/logger";
import { isFailure, isSuccess } from "@sdxc/result";
import { RequestContext } from "remix/router";
import { createSession, Session } from "remix/session";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { createTags } from "./create-tags.js";
import cacheMiddleware from "./middleware.js";
import { CACHE_CONTROL_HEADER, CACHE_TAG_HEADER, NON_CACHEABLE_POLICY } from "./platform.js";
import { PurgeError } from "./purge-error.js";
import { createRecordingCache } from "./recording-cache.js";
import { UnsafeCachePolicyError } from "./unsafe-cache-policy-error.js";

/** A public policy, the kind an app would build once and import everywhere. */
const PUBLIC_PAGE = "public, max-age=86400, stale-while-revalidate=604800";

/** A private policy, safe on a response built for one visitor. */
const PRIVATE_PAGE = "private, max-age=60";

const TAGS = createTags({
	post: (id: string) => `post:${id}`,
	postList: () => "posts",
	tenant: (id: string) => `tenant:${id}`,
});

/** The value the environment had before a test pinned it, restored afterwards. */
let previousNodeEnv = process.env.NODE_ENV;

/** Builds a request context, defaulting to a cacheable request on a public host. */
function makeContext(path = "/posts/1", init: RequestInit = {}): RequestContext {
	return new RequestContext(new Request(new URL(path, "https://example.com"), init));
}

/**
 * Opens an invocation's log whose emitted record a test reads back. `record()` is a call
 * rather than a property so it is read after the log emits, not when it is destructured.
 */
function openLog() {
	let records: Record<string, unknown>[] = [];
	let log = new Log({ kind: "request", sink: (record) => void records.push(record) });
	return { log, record: (): Record<string, unknown> => records[0] ?? {} };
}

/** Headers that reject mutation, like those on a platform-produced response. */
class ImmutableHeaders extends Headers {
	/** Rejects the write the middleware attempts first. */
	override set(): void {
		throw new TypeError("Headers are immutable");
	}
}

/** Wraps a response so its headers cannot be mutated in place. */
function makeImmutable(response: Response): Response {
	Object.defineProperty(response, "headers", {
		value: new ImmutableHeaders(response.headers),
		configurable: true,
	});
	return response;
}

/** Counts how many times a header name appears, to catch duplicated writes. */
function countHeader(response: Response, name: string): number {
	return [...response.headers].filter(([header]) => header === name.toLowerCase()).length;
}

/**
 * Refusals log in production and throw in development, so pin the mode and
 * let the tests that care about the throw opt into it.
 */
beforeEach(() => {
	process.env.NODE_ENV = "production";
});

afterEach(() => {
	if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = previousNodeEnv;
});

describe("cache middleware", () => {
	test("writes the declared policy and tags onto the response", async () => {
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();

		let response = await middleware(context, async () => {
			context.cache(PUBLIC_PAGE, TAGS.post("1"), TAGS.postList());
			return new Response("ok");
		});

		expect(response.headers.get(CACHE_CONTROL_HEADER)).toBe(PUBLIC_PAGE);
		expect(response.headers.get(CACHE_TAG_HEADER)).toBe("post:1,posts");
	});

	test("records the applied policy and tag count on the invocation's log", async () => {
		let { log, record } = openLog();
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();

		await log.run(() =>
			middleware(context, async () => {
				context.cache(PUBLIC_PAGE, TAGS.post("1"), TAGS.postList());
				return new Response("ok");
			}),
		);

		expect(record()).toMatchObject({
			"cache.policy": PUBLIC_PAGE,
			"cache.tag_count": 2,
			outcome: "ok",
		});
		expect(record().notes).toBeUndefined();
	});

	test("writes a policy with no tags, which is a legitimate declaration", async () => {
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();

		let response = await middleware(context, async () => {
			context.cache(PUBLIC_PAGE);
			return new Response("ok");
		});

		expect(response.headers.get(CACHE_CONTROL_HEADER)).toBe(PUBLIC_PAGE);
		expect(response.headers.has(CACHE_TAG_HEADER)).toBe(false);
	});

	test("accepts the object form of a declaration", async () => {
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();

		let response = await middleware(context, async () => {
			context.cache({ policy: PUBLIC_PAGE, tags: [TAGS.post("1")] });
			return new Response("ok");
		});

		expect(response.headers.get(CACHE_CONTROL_HEADER)).toBe(PUBLIC_PAGE);
		expect(response.headers.get(CACHE_TAG_HEADER)).toBe("post:1");
	});

	test("accumulates tags across two declarations into one header", async () => {
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();

		/** A controller-scoped middleware contributing a tag to every response. */
		let scoped = async (next: () => Promise<Response>) => {
			context.cache(PUBLIC_PAGE, TAGS.tenant("acme"));
			return next();
		};

		let response = await middleware(context, () =>
			scoped(async () => {
				context.cache(PUBLIC_PAGE, TAGS.post("1"), TAGS.tenant("acme"));
				return new Response("ok");
			}),
		);

		expect(countHeader(response, CACHE_TAG_HEADER)).toBe(1);
		expect(response.headers.get(CACHE_TAG_HEADER)).toBe("tenant:acme,post:1");
	});

	test("keeps the most recent policy when two declarations disagree", async () => {
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();

		let response = await middleware(context, async () => {
			context.cache(PUBLIC_PAGE, TAGS.postList());
			context.cache(PRIVATE_PAGE, TAGS.post("1"));
			return new Response("ok");
		});

		expect(countHeader(response, CACHE_CONTROL_HEADER)).toBe(1);
		expect(response.headers.get(CACHE_CONTROL_HEADER)).toBe(PRIVATE_PAGE);
		expect(response.headers.get(CACHE_TAG_HEADER)).toBe("posts,post:1");
	});

	test("writes the headers only after next() resolves", async () => {
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();
		let seenDuringChain: string | null = "not-read";

		let response = await middleware(context, async () => {
			context.cache(PUBLIC_PAGE, TAGS.postList());
			let handled = new Response("ok");
			seenDuringChain = handled.headers.get(CACHE_CONTROL_HEADER);
			return handled;
		});

		expect(seenDuringChain).toBeNull();
		expect(response.headers.get(CACHE_CONTROL_HEADER)).toBe(PUBLIC_PAGE);
	});

	test("copies the response when its headers reject mutation", async () => {
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();

		let response = await middleware(context, async () => {
			context.cache(PUBLIC_PAGE, TAGS.postList());
			return makeImmutable(new Response("ok", { status: 200, statusText: "OK" }));
		});

		expect(response.headers.get(CACHE_CONTROL_HEADER)).toBe(PUBLIC_PAGE);
		expect(response.headers.get(CACHE_TAG_HEADER)).toBe("posts");
		expect(await response.text()).toBe("ok");
	});

	test("resolves the cache interface from the context when given a resolver", async () => {
		let recording = createRecordingCache();
		let seen: Context | undefined;
		let middleware = cacheMiddleware({
			cache: (context) => {
				seen = context;
				return recording;
			},
		});
		let context = makeContext();

		await middleware(context, async () => {
			await context.cache.purge(TAGS.postList());
			return new Response("ok");
		});

		expect(seen).toBe(context);
		expect(recording.purgedTags).toEqual(["posts"]);
	});
});

describe("cache middleware refusals", () => {
	test("downgrades and warns when the response carries Set-Cookie", async () => {
		let { log, record } = openLog();
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();

		let response = await log.run(() =>
			middleware(context, async () => {
				context.cache(PUBLIC_PAGE, TAGS.postList());
				return new Response("ok", { headers: { "Set-Cookie": "flash=1; Path=/" } });
			}),
		);

		expect(response.headers.get(CACHE_CONTROL_HEADER)).toBe(NON_CACHEABLE_POLICY);
		expect(response.headers.has(CACHE_TAG_HEADER)).toBe(false);
		expect(record()).toMatchObject({
			"cache.downgraded": true,
			"cache.refusal": "set-cookie",
			outcome: "degraded",
		});
		expect(record().notes).toEqual([
			expect.objectContaining({
				level: "warn",
				name: "cache.downgraded",
				reason: "set-cookie",
				policy: PUBLIC_PAGE,
			}),
		]);
	});

	test("downgrades when a Set-Cookie is attached after the declaration", async () => {
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();

		/** A downstream middleware that attaches a cookie to the finished response. */
		let attachesCookie = async (next: () => Promise<Response>) => {
			let response = await next();
			response.headers.append("Set-Cookie", "flash=1; Path=/");
			return response;
		};

		let response = await middleware(context, () =>
			attachesCookie(async () => {
				context.cache(PUBLIC_PAGE, TAGS.postList());
				return new Response("ok");
			}),
		);

		expect(response.headers.get(CACHE_CONTROL_HEADER)).toBe(NON_CACHEABLE_POLICY);
		expect(response.headers.has(CACHE_TAG_HEADER)).toBe(false);
	});

	test("downgrades and warns about a public policy on a session-bearing request", async () => {
		let { log, record } = openLog();
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();

		let session = createSession();
		session.set("userId", "user_1");
		context.set(Session, session, { property: "session" });

		let response = await log.run(() =>
			middleware(context, async () => {
				context.cache(PUBLIC_PAGE, TAGS.postList());
				return new Response("ok");
			}),
		);

		expect(response.headers.get(CACHE_CONTROL_HEADER)).toBe(NON_CACHEABLE_POLICY);
		expect(response.headers.has(CACHE_TAG_HEADER)).toBe(false);
		expect(record()["cache.refusal"]).toBe("session-with-public-policy");
	});

	test("keeps a private policy on a session-bearing request", async () => {
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();

		let session = createSession();
		session.set("userId", "user_1");
		context.set(Session, session, { property: "session" });

		let response = await middleware(context, async () => {
			context.cache(PRIVATE_PAGE, TAGS.postList());
			return new Response("ok");
		});

		expect(response.headers.get(CACHE_CONTROL_HEADER)).toBe(PRIVATE_PAGE);
		expect(response.headers.get(CACHE_TAG_HEADER)).toBe("posts");
	});

	test("treats an untouched session as anonymous, even with cookies on the request", async () => {
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext("/posts/1", { headers: { Cookie: "theme=dark" } });
		context.set(Session, createSession(), { property: "session" });

		let response = await middleware(context, async () => {
			context.cache(PUBLIC_PAGE, TAGS.postList());
			return new Response("ok");
		});

		expect(response.headers.get(CACHE_CONTROL_HEADER)).toBe(PUBLIC_PAGE);
	});

	test("refuses a public policy on a cookie-bearing request when no session ran", async () => {
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext("/posts/1", { headers: { Cookie: "sid=abc" } });

		let response = await middleware(context, async () => {
			context.cache(PUBLIC_PAGE, TAGS.postList());
			return new Response("ok");
		});

		expect(response.headers.get(CACHE_CONTROL_HEADER)).toBe(NON_CACHEABLE_POLICY);
	});

	test("emits nothing for a method other than GET or HEAD", async () => {
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext("/posts/1", { method: "POST" });
		let handled = new Response("ok");

		let response = await middleware(context, async () => {
			context.cache(PUBLIC_PAGE, TAGS.postList());
			return handled;
		});

		expect(response).toBe(handled);
		expect(response.headers.has(CACHE_CONTROL_HEADER)).toBe(false);
		expect(response.headers.has(CACHE_TAG_HEADER)).toBe(false);
	});

	test("emits nothing for a status that is not cacheable", async () => {
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();
		let handled = new Response("boom", { status: 500 });

		let response = await middleware(context, async () => {
			context.cache(PUBLIC_PAGE, TAGS.postList());
			return handled;
		});

		expect(response).toBe(handled);
		expect(response.headers.has(CACHE_CONTROL_HEADER)).toBe(false);
		expect(response.headers.has(CACHE_TAG_HEADER)).toBe(false);
	});

	test("emits nothing when no declaration was made", async () => {
		let { log, record } = openLog();
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();
		let handled = new Response("ok", { headers: { "Set-Cookie": "flash=1" } });

		let response = await log.run(() => middleware(context, async () => handled));

		expect(response).toBe(handled);
		expect(response.headers.has(CACHE_CONTROL_HEADER)).toBe(false);
		expect(response.headers.has(CACHE_TAG_HEADER)).toBe(false);
		expect(Object.keys(record).filter((key) => key.startsWith("cache."))).toEqual([]);
		expect(record().notes).toBeUndefined();
	});

	test("throws in development instead of only warning", async () => {
		process.env.NODE_ENV = "development";
		let { log, record } = openLog();
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();

		let run = log.run(() =>
			middleware(context, async () => {
				context.cache(PUBLIC_PAGE, TAGS.postList());
				return new Response("ok", { headers: { "Set-Cookie": "flash=1" } });
			}),
		);

		await expect(run).rejects.toThrow(UnsafeCachePolicyError);
		expect(record()["cache.downgraded"]).toBe(true);
		expect(record().notes).toEqual([expect.objectContaining({ name: "cache.downgraded" })]);
	});

	test("treats a local host as development when the mode is unset", async () => {
		delete process.env.NODE_ENV;
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = new RequestContext(new Request("http://localhost:3000/posts/1"));

		let run = middleware(context, async () => {
			context.cache(PUBLIC_PAGE, TAGS.postList());
			return new Response("ok", { headers: { "Set-Cookie": "flash=1" } });
		});

		await expect(run).rejects.toThrow(UnsafeCachePolicyError);
	});

	test("still downgrades, without throwing, when no log is current", async () => {
		let middleware = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();

		let response = await middleware(context, async () => {
			context.cache(PUBLIC_PAGE, TAGS.postList());
			return new Response("ok", { headers: { "Set-Cookie": "flash=1" } });
		});

		expect(response.headers.get(CACHE_CONTROL_HEADER)).toBe(NON_CACHEABLE_POLICY);
	});

	test("writes one set of headers when the middleware is registered twice", async () => {
		let outer = cacheMiddleware({ cache: createRecordingCache() });
		let inner = cacheMiddleware({ cache: createRecordingCache() });
		let context = makeContext();

		let response = await outer(context, async () =>
			inner(context, async () => {
				context.cache(PUBLIC_PAGE, TAGS.post("1"));
				return new Response("ok");
			}),
		);

		expect(countHeader(response, CACHE_CONTROL_HEADER)).toBe(1);
		expect(countHeader(response, CACHE_TAG_HEADER)).toBe(1);
		expect(response.headers.get(CACHE_TAG_HEADER)).toBe("post:1");
	});
});

describe("cache middleware purging", () => {
	test("awaits a purge and returns its result", async () => {
		let recording = createRecordingCache();
		let middleware = cacheMiddleware({ cache: recording });
		let context = makeContext("/posts/1", { method: "POST" });
		let purgedBeforeResponse = false;

		await middleware(context, async () => {
			let result = await context.cache.purge(TAGS.post("1"), TAGS.postList());
			purgedBeforeResponse = isSuccess(result) && recording.purges.length === 1;
			return new Response("ok");
		});

		expect(purgedBeforeResponse).toBe(true);
		expect(recording.purgedTags).toEqual(["post:1", "posts"]);
	});

	test("returns a failure when the platform rejects a purge", async () => {
		let recording = createRecordingCache({ failWith: new Error("edge unavailable") });
		let middleware = cacheMiddleware({ cache: recording });
		let context = makeContext("/posts/1", { method: "POST" });
		let failed: unknown;

		await middleware(context, async () => {
			let result = await context.cache.purge(TAGS.postList());
			if (isFailure(result)) failed = result.error;
			return new Response("ok");
		});

		expect(failed).toBeInstanceOf(PurgeError);
	});

	test("fails a purge with no tags instead of invalidating anything", async () => {
		let recording = createRecordingCache();
		let middleware = cacheMiddleware({ cache: recording });
		let context = makeContext("/posts/1", { method: "POST" });
		let failed = false;

		await middleware(context, async () => {
			failed = isFailure(await context.cache.purge());
			return new Response("ok");
		});

		expect(failed).toBe(true);
		expect(recording.purges).toEqual([]);
	});

	test("flushes a deferred purge after the response is produced", async () => {
		let recording = createRecordingCache();
		let middleware = cacheMiddleware({ cache: recording });
		let context = makeContext("/posts/1", { method: "POST" });
		let purgesDuringRequest = -1;

		await middleware(context, async () => {
			context.cache.purgeLater(TAGS.postList(), TAGS.post("1"), TAGS.postList());
			purgesDuringRequest = recording.purges.length;
			return new Response("ok");
		});

		expect(purgesDuringRequest).toBe(0);
		expect(recording.purges).toEqual([{ tags: ["posts", "post:1"] }]);
	});

	test("warns about a failed deferred purge instead of throwing it", async () => {
		let { log, record } = openLog();
		let recording = createRecordingCache({ failWith: new Error("edge unavailable") });
		let middleware = cacheMiddleware({ cache: recording });
		let context = makeContext("/posts/1", { method: "POST" });

		let response = await log.run(() =>
			middleware(context, async () => {
				context.cache.purgeLater(TAGS.postList());
				return new Response("ok");
			}),
		);

		expect(response.status).toBe(200);
		expect(record().outcome).toBe("degraded");
		expect(record().notes).toEqual([
			expect.objectContaining({
				level: "warn",
				name: "cache.purge_failed",
				tags: "posts",
				error: expect.stringContaining("edge unavailable"),
			}),
		]);
	});

	test("swallows a failed deferred purge when no log is current", async () => {
		let recording = createRecordingCache({ failWith: new Error("edge unavailable") });
		let middleware = cacheMiddleware({ cache: recording });
		let context = makeContext("/posts/1", { method: "POST" });

		let response = await middleware(context, async () => {
			context.cache.purgeLater(TAGS.postList());
			return new Response("ok");
		});

		expect(response.status).toBe(200);
	});

	test("flushes deferred purges even when the handler throws", async () => {
		let recording = createRecordingCache();
		let middleware = cacheMiddleware({ cache: recording });
		let context = makeContext("/posts/1", { method: "POST" });

		let run = middleware(context, async () => {
			context.cache.purgeLater(TAGS.postList());
			throw new Error("handler failed");
		});

		await expect(run).rejects.toThrow("handler failed");
		expect(recording.purgedTags).toEqual(["posts"]);
	});
});
