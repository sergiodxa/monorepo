/**
 * Tests for the sponsor roster read. The assertion that matters is the privacy one: a token
 * that owns the account can see sponsorships their sponsor asked to keep private, so every
 * path out of this module is held to naming only the public ones.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryCache } from "@sdxc/cache/memory";
import { isFailure, isSuccess } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { SponsorRoster } from "~/app/services/sponsors";

import {
	fetchSponsorRoster,
	NO_SPONSORS,
	readStoredSponsors,
	refreshSponsors,
	SPONSORS_CACHE_KEY,
	sponsorRoster,
} from "~/app/services/sponsors";

/** Where the sponsors query is sent, which is the one request these tests intercept. */
const GRAPHQL_URL = "https://api.github.com/graphql";

/** The credential the tests query with; the interceptor answers whatever it carries. */
const TOKEN = "token-for-tests";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Builds a sponsorship node the way GitHub answers with one. */
function node(login: string, privacyLevel: "PUBLIC" | "PRIVATE" = "PUBLIC") {
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

/** Wraps the active and all-time sponsorships in the envelope the query answers with. */
function payload(current: unknown[], ever: unknown[] = current) {
	return { data: { user: { current: { nodes: current }, ever: { nodes: ever } } } };
}

/** The logins of each list in a roster, which is what most assertions compare. */
function logins(roster: SponsorRoster) {
	return {
		current: roster.current.map((sponsor) => sponsor.login),
		past: roster.past.map((sponsor) => sponsor.login),
	};
}

describe("sponsorRoster", () => {
	test("keeps only the sponsorships GitHub marks public", () => {
		let roster = sponsorRoster(
			payload(
				[node("ada"), node("grace", "PRIVATE")],
				[node("ada"), node("grace", "PRIVATE"), node("alan"), node("hedy", "PRIVATE")],
			),
		);

		expect(logins(roster)).toEqual({ current: ["ada"], past: ["alan"] });
	});

	test("names a past sponsor as everyone ever, less the current ones, in GitHub's order", () => {
		let roster = sponsorRoster(
			payload(
				[node("ada"), node("alan")],
				[node("hedy"), node("alan"), node("grace"), node("ada")],
			),
		);

		expect(logins(roster)).toEqual({ current: ["ada", "alan"], past: ["hedy", "grace"] });
	});

	test("names a past sponsor once, however many sponsorships they ended", () => {
		expect(logins(sponsorRoster(payload([], [node("hedy"), node("hedy")])))).toEqual({
			current: [],
			past: ["hedy"],
		});
	});

	test("falls back to the login when a sponsor set no name", () => {
		let roster = sponsorRoster(
			payload([{ ...node("ada"), sponsorEntity: { ...node("ada").sponsorEntity, name: null } }]),
		);

		expect(roster.current[0]?.name).toBe("ada");
	});

	test("names nobody when the payload is not the shape the query asks for", () => {
		expect(sponsorRoster({ errors: [{ message: "Bad credentials" }] })).toEqual(NO_SPONSORS);
		expect(sponsorRoster(null)).toEqual(NO_SPONSORS);
		expect(sponsorRoster({ data: { user: null } })).toEqual(NO_SPONSORS);
	});
});

describe("fetchSponsorRoster", () => {
	test("asks for the public view of both lists, with the credential", async () => {
		let asked: { query: string } | null = null;
		let authorization: string | null = null;

		server.use(
			http.post(GRAPHQL_URL, async ({ request }) => {
				asked = (await request.json()) as { query: string };
				authorization = request.headers.get("authorization");
				return HttpResponse.json(payload([node("ada")]));
			}),
		);

		let roster = await fetchSponsorRoster(TOKEN);
		let query = (asked as { query: string } | null)?.query ?? "";

		expect(isSuccess(roster) && logins(roster.data).current).toEqual(["ada"]);
		expect(query.match(/includePrivate: false/g)).toHaveLength(2);
		expect(query).not.toContain("privacyLevel");
		expect(query).not.toContain("isActive");
		expect(authorization).toBe(`Bearer ${TOKEN}`);
	});

	test("fails rather than reporting nobody when GitHub refuses the query", async () => {
		server.use(
			http.post(GRAPHQL_URL, () =>
				HttpResponse.json({ data: { user: null }, errors: [{ message: "INSUFFICIENT_SCOPES" }] }),
			),
		);

		let roster = await fetchSponsorRoster(TOKEN);

		expect(isFailure(roster) && roster.error.message).toContain("INSUFFICIENT_SCOPES");
	});

	test("fails when GitHub answers with an error status", async () => {
		server.use(http.post(GRAPHQL_URL, () => new HttpResponse(null, { status: 401 })));

		let roster = await fetchSponsorRoster(TOKEN);

		expect(isFailure(roster) && roster.error.message).toContain("401");
	});
});

describe("refreshSponsors", () => {
	test("stores the public roster for a later read", async () => {
		server.use(
			http.post(GRAPHQL_URL, () =>
				HttpResponse.json(payload([node("ada"), node("grace", "PRIVATE")], [node("alan")])),
			),
		);

		let cache = new MemoryCache();
		await refreshSponsors(cache, TOKEN);

		expect(logins(await readStoredSponsors(cache))).toEqual({ current: ["ada"], past: ["alan"] });
	});

	test("leaves the stored roster alone when GitHub cannot be read", async () => {
		server.use(http.post(GRAPHQL_URL, () => HttpResponse.error()));

		let cache = new MemoryCache();
		await cache.write(SPONSORS_CACHE_KEY, { current: [node("ada").sponsorEntity], past: [] });

		let roster = await refreshSponsors(cache, TOKEN);

		expect(isFailure(roster)).toBe(true);
		expect(logins(await readStoredSponsors(cache)).current).toEqual(["ada"]);
	});
});

describe("readStoredSponsors", () => {
	test("names nobody when nothing has been stored", async () => {
		expect(await readStoredSponsors(new MemoryCache())).toEqual(NO_SPONSORS);
	});
});
