/**
 * Tests `GET /health` through the real router: the report is `application/health+json`, a
 * GitHub outage only warns because pages serve its cached data, and a store the site reads
 * failing turns the report into a `503`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Cache } from "@sdxc/cache";

import { CacheError } from "@sdxc/cache";
import { MemoryCache } from "@sdxc/cache/memory";
import { parseHealth } from "@sdxc/health";
import { failure, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { createMemoryFileStorage } from "remix/file-storage/memory";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

/** The cache the `cache` probe reads, replaced per test. */
let cache: Cache = new MemoryCache();

vi.doMock("~/app/initializers/cache", () => ({ siteCache: () => cache }));
vi.doMock("~/app/models/social-cards", () => ({ socialCards: () => createMemoryFileStorage() }));

let { fetchApp } = await import("~/app/test/router");

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
	cache = new MemoryCache();
});

/** A cache whose namespace cannot be reached, the way a broken KV binding answers. */
class UnreachableCache extends MemoryCache {
	override async read() {
		return failure(new CacheError("KV refused the read", { code: "unavailable", key: "health" }));
	}
}

/**
 * Answers GitHub's rate-limit read with `status`, recording the headers it received. The
 * answer has no body: the check cancels a probe's body unread, and under `msw/node` cancelling
 * a mocked body never settles, which would time the probe out.
 */
function answerGitHub(status: number) {
	let received: Headers[] = [];
	server.use(
		http.get("https://api.github.com/rate_limit", ({ request }) => {
			received.push(request.headers);
			return new HttpResponse(null, { status });
		}),
	);
	return received;
}

/** Requests the report and reads it back through the format's own parser. */
async function report() {
	let response = await fetchApp("/health");
	return { response, report: unwrap(parseHealth(await response.text())) };
}

describe("GET /health", () => {
	test("passes when every store and GitHub answer", async () => {
		let received = answerGitHub(200);

		let { response, report: body } = await report();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("application/health+json");
		expect(body.status).toBe("pass");
		expect(body.serviceId).toBe("sdxc");
		expect(Object.keys(body.checks ?? {})).toEqual([
			"cache:responseTime",
			"social-cards:responseTime",
			"github:responseTime",
		]);
		expect(received[0]?.get("authorization")).toBe("Bearer test-GITHUB_TOKEN");
	});

	test("warns and still answers 200 while GitHub fails", async () => {
		answerGitHub(503);

		let { response, report: body } = await report();

		expect(response.status).toBe(200);
		expect(body.status).toBe("warn");
		expect(body.checks?.["github:responseTime"]?.[0]).toMatchObject({
			status: "warn",
			output: "HTTP 503",
		});
	});

	test("fails with a 503 when the cache cannot be read", async () => {
		answerGitHub(200);
		cache = new UnreachableCache();

		let { response, report: body } = await report();

		expect(response.status).toBe(503);
		expect(body.status).toBe("fail");
		expect(body.checks?.["cache:responseTime"]?.[0]).toMatchObject({ status: "fail" });
	});
});
