/**
 * Tests GitHub's sponsorship webhook through the real router: only a delivery signed with
 * the hook's secret is acted on, and a signed `sponsorship` event stores a fresh roster
 * read from GitHub where the pages read it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { MemoryCache } from "@sdxc/cache/memory";
import { hmac, Hex } from "@sdxc/crypto";
import { unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

/** The secret the test environment supplies for every binding named like this one. */
const SECRET = "test-GITHUB_SPONSORS_WEBHOOK_SECRET";

/** The cache the webhook writes the roster to, replaced per test. */
let cache = new MemoryCache();

vi.doMock("~/app/services/cache", () => ({ siteCache: () => cache }));

let { fetchApp } = await import("~/app/lib/test/router");
let { SPONSORS_CACHE_KEY } = await import("~/app/services/sponsors");

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
	cache = new MemoryCache();
});

/** A sponsorship node naming `login`, the way GitHub answers with one. */
function node(login: string) {
	return {
		sponsorEntity: {
			login,
			name: login,
			avatarUrl: `https://avatars.githubusercontent.com/${login}`,
			url: `https://github.com/${login}`,
		},
	};
}

/** Answers the sponsors query with `ada` as the one current sponsor. */
function answerRoster() {
	server.use(
		http.post("https://api.github.com/graphql", () =>
			HttpResponse.json({
				data: { user: { current: { nodes: [node("ada")] }, ever: { nodes: [node("ada")] } } },
			}),
		),
	);
}

/**
 * Posts a delivery of `event`, signed with `secret`.
 *
 * @param event The `X-GitHub-Event` it reports.
 * @param secret The secret its signature is made with.
 */
async function deliver(event: string, secret = SECRET) {
	let body = JSON.stringify({ action: "created" });
	let signature = Hex.encode(unwrap(await hmac.sign(secret, body)));

	return await fetchApp("/webhooks/sponsors", {
		method: "POST",
		headers: {
			"content-type": "application/json",
			"x-github-event": event,
			"x-hub-signature-256": `sha256=${signature}`,
		},
		body,
	});
}

describe("POST /webhooks/sponsors", () => {
	test("stores a fresh roster on a signed sponsorship event", async () => {
		answerRoster();

		let response = await deliver("sponsorship");

		expect(response.status).toBe(204);
		expect(unwrap(await cache.read(SPONSORS_CACHE_KEY))).toEqual({
			current: [expect.objectContaining({ login: "ada" })],
			past: [],
		});
	});

	test("acknowledges the ping GitHub sends when the hook is created", async () => {
		let response = await deliver("ping");

		expect(response.status).toBe(204);
		expect(unwrap(await cache.read(SPONSORS_CACHE_KEY))).toBeNull();
	});

	test("refuses a delivery signed with another secret", async () => {
		let response = await deliver("sponsorship", "someone-else");

		expect(response.status).toBe(401);
		expect(unwrap(await cache.read(SPONSORS_CACHE_KEY))).toBeNull();
	});

	test("refuses an unsigned delivery", async () => {
		let response = await fetchApp("/webhooks/sponsors", {
			method: "POST",
			headers: { "content-type": "application/json", "x-github-event": "sponsorship" },
			body: "{}",
		});

		expect(response.status).toBe(401);
	});

	test("reports a failed GitHub read so the delivery can be retried", async () => {
		server.use(
			http.post("https://api.github.com/graphql", () => new HttpResponse(null, { status: 500 })),
		);

		let response = await deliver("sponsorship");

		expect(response.status).toBe(502);
		expect(unwrap(await cache.read(SPONSORS_CACHE_KEY))).toBeNull();
	});
});
