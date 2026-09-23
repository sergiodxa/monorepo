/**
 * Tests for the sponsors read. The assertion that matters is the privacy one: a token
 * that owns the account can see sponsorships their sponsor asked to keep private, so
 * every path out of this module is held to naming only the public ones.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryCache } from "@sdxc/cache/memory";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import {
	fetchPublicSponsors,
	publicSponsors,
	readStoredSponsors,
	refreshSponsors,
	SPONSORS_CACHE_KEY,
} from "~/app/services/sponsors";

/** Where the sponsors query is sent, which is the one request these tests intercept. */
const GRAPHQL_URL = "https://api.github.com/graphql";

/** The credential the tests query with; the interceptor answers whatever it carries. */
const TOKEN = "token-for-tests";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Builds a sponsorship node the way GitHub answers with one.
 *
 * @param login The sponsor's login, which also names their avatar and profile.
 * @param privacyLevel How GitHub marks the sponsorship.
 * @returns One node of the sponsors query's response.
 */
function node(login: string, privacyLevel: "PUBLIC" | "PRIVATE") {
	return {
		privacyLevel,
		sponsorEntity: {
			login,
			name: `${login} the sponsor`,
			avatarUrl: `https://avatars.githubusercontent.com/${login}`,
			url: `https://github.com/${login}`,
		},
	};
}

/**
 * Wraps sponsorship nodes in the envelope the query answers with.
 *
 * @param nodes The sponsorships to answer with.
 * @returns The whole response body.
 */
function payload(nodes: unknown[]) {
	return { data: { user: { sponsorshipsAsMaintainer: { nodes } } } };
}

describe("publicSponsors", () => {
	test("keeps a sponsorship the query already filtered, whatever the token could read", () => {
		let sponsors = publicSponsors(
			payload([{ sponsorEntity: node("ada", "PUBLIC").sponsorEntity }]),
		);

		expect(sponsors.map((sponsor) => sponsor.login)).toEqual(["ada"]);
	});

	test("keeps only the sponsorships GitHub marks public", () => {
		let sponsors = publicSponsors(
			payload([node("ada", "PUBLIC"), node("grace", "PRIVATE"), node("alan", "PUBLIC")]),
		);

		expect(sponsors.map((sponsor) => sponsor.login)).toEqual(["ada", "alan"]);
	});

	test("names nobody when every sponsorship is private", () => {
		expect(publicSponsors(payload([node("grace", "PRIVATE")]))).toEqual([]);
	});

	test("falls back to the login when a sponsor set no name", () => {
		let sponsors = publicSponsors(
			payload([
				{
					...node("ada", "PUBLIC"),
					sponsorEntity: { ...node("ada", "PUBLIC").sponsorEntity, name: null },
				},
			]),
		);

		expect(sponsors[0]?.name).toBe("ada");
	});

	test("skips a sponsorship whose sponsor the query could not read", () => {
		expect(publicSponsors(payload([{ privacyLevel: "PUBLIC", sponsorEntity: null }]))).toEqual([]);
	});

	test("names nobody when the payload is not the shape the query asks for", () => {
		expect(publicSponsors({ errors: [{ message: "Bad credentials" }] })).toEqual([]);
		expect(publicSponsors(null)).toEqual([]);
	});

	test("names nobody when the account has no sponsors", () => {
		expect(publicSponsors({ data: { user: null } })).toEqual([]);
	});
});

describe("fetchPublicSponsors", () => {
	test("asks GitHub for the public view and keeps only public sponsorships", async () => {
		let asked: unknown = null;

		server.use(
			http.post(GRAPHQL_URL, async ({ request }) => {
				asked = await request.json();
				return HttpResponse.json(payload([node("ada", "PUBLIC"), node("grace", "PRIVATE")]));
			}),
		);

		let sponsors = await fetchPublicSponsors(TOKEN);

		expect(sponsors.map((sponsor) => sponsor.login)).toEqual(["ada"]);
		expect((asked as { query: string }).query).toContain("includePrivate: false");
	});

	test("asks for no field a narrower token cannot read", async () => {
		let asked: unknown = null;

		server.use(
			http.post(GRAPHQL_URL, async ({ request }) => {
				asked = await request.json();
				return HttpResponse.json(payload([]));
			}),
		);

		await fetchPublicSponsors(TOKEN);

		expect((asked as { query: string }).query).not.toContain("privacyLevel");
	});

	test("fails rather than reporting nobody when GitHub refuses the query", async () => {
		server.use(
			http.post(GRAPHQL_URL, () =>
				HttpResponse.json({
					data: { user: null },
					errors: [{ message: "INSUFFICIENT_SCOPES: the field requires read:user" }],
				}),
			),
		);

		await expect(fetchPublicSponsors(TOKEN)).rejects.toThrow("INSUFFICIENT_SCOPES");
	});

	test("reports nobody, and nothing invented, when the account has no sponsors", async () => {
		server.use(http.post(GRAPHQL_URL, () => HttpResponse.json(payload([]))));

		await expect(fetchPublicSponsors(TOKEN)).resolves.toEqual([]);
	});

	test("carries the credential", async () => {
		let authorization: string | null = null;

		server.use(
			http.post(GRAPHQL_URL, ({ request }) => {
				authorization = request.headers.get("authorization");
				return HttpResponse.json(payload([]));
			}),
		);

		await fetchPublicSponsors(TOKEN);

		expect(authorization).toBe(`Bearer ${TOKEN}`);
	});

	test("fails when GitHub refuses the query", async () => {
		server.use(http.post(GRAPHQL_URL, () => new HttpResponse(null, { status: 401 })));

		await expect(fetchPublicSponsors(TOKEN)).rejects.toThrow("401");
	});
});

describe("refreshSponsors", () => {
	test("stores the public sponsors for a later read", async () => {
		server.use(
			http.post(GRAPHQL_URL, () =>
				HttpResponse.json(payload([node("ada", "PUBLIC"), node("grace", "PRIVATE")])),
			),
		);

		let cache = new MemoryCache();
		await refreshSponsors(cache, TOKEN);

		let stored = await readStoredSponsors(cache);
		expect(stored.map((sponsor) => sponsor.login)).toEqual(["ada"]);
	});

	test("leaves the stored list alone when GitHub cannot be read", async () => {
		server.use(http.post(GRAPHQL_URL, () => HttpResponse.error()));

		let cache = new MemoryCache();
		await cache.write(SPONSORS_CACHE_KEY, [
			{
				login: "ada",
				name: "Ada",
				avatarUrl: "https://example.test/a",
				url: "https://example.test",
			},
		]);

		await expect(refreshSponsors(cache, TOKEN)).rejects.toThrow();
		expect((await readStoredSponsors(cache)).map((sponsor) => sponsor.login)).toEqual(["ada"]);
	});
});

describe("readStoredSponsors", () => {
	test("names nobody when nothing has been stored", async () => {
		expect(await readStoredSponsors(new MemoryCache())).toEqual([]);
	});
});
