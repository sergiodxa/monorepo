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
	fetchSponsorRoster,
	NO_SPONSORS,
	readStoredSponsors,
	refreshSponsors,
	SPONSORS_CACHE_KEY,
	sponsorRoster,
	sponsorsTag,
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
 * @param current The active sponsorships.
 * @param ever Every sponsorship, active ones included, as GitHub lists them.
 * @returns The whole response body.
 */
function payload(current: unknown[], ever: unknown[] = current) {
	return { data: { user: { current: { nodes: current }, ever: { nodes: ever } } } };
}

/** The logins of each list in a roster, which is what most assertions compare. */
function logins(roster: { current: { login: string }[]; past: { login: string }[] }) {
	return {
		current: roster.current.map((sponsor) => sponsor.login),
		past: roster.past.map((sponsor) => sponsor.login),
	};
}

describe("sponsorRoster", () => {
	test("keeps a sponsorship the query already filtered, whatever the token could read", () => {
		let roster = sponsorRoster(payload([{ sponsorEntity: node("ada", "PUBLIC").sponsorEntity }]));

		expect(logins(roster).current).toEqual(["ada"]);
	});

	test("keeps only the sponsorships GitHub marks public", () => {
		let roster = sponsorRoster(
			payload(
				[node("ada", "PUBLIC"), node("grace", "PRIVATE")],
				[
					node("ada", "PUBLIC"),
					node("grace", "PRIVATE"),
					node("alan", "PUBLIC"),
					node("hedy", "PRIVATE"),
				],
			),
		);

		expect(logins(roster)).toEqual({ current: ["ada"], past: ["alan"] });
	});

	test("names a past sponsor as everyone ever, less the current ones, in GitHub's order", () => {
		let roster = sponsorRoster(
			payload(
				[node("ada", "PUBLIC"), node("alan", "PUBLIC")],
				[
					node("hedy", "PUBLIC"),
					node("alan", "PUBLIC"),
					node("grace", "PUBLIC"),
					node("ada", "PUBLIC"),
				],
			),
		);

		expect(logins(roster)).toEqual({ current: ["ada", "alan"], past: ["hedy", "grace"] });
	});

	test("names a sponsor who came back once, as a current sponsor", () => {
		let roster = sponsorRoster(
			payload([node("ada", "PUBLIC")], [node("ada", "PUBLIC"), node("ada", "PUBLIC")]),
		);

		expect(logins(roster)).toEqual({ current: ["ada"], past: [] });
	});

	test("names a past sponsor once, however many sponsorships they ended", () => {
		let roster = sponsorRoster(payload([], [node("hedy", "PUBLIC"), node("hedy", "PUBLIC")]));

		expect(logins(roster)).toEqual({ current: [], past: ["hedy"] });
	});

	test("names nobody when every sponsorship is private", () => {
		expect(sponsorRoster(payload([node("grace", "PRIVATE")]))).toEqual(NO_SPONSORS);
	});

	test("falls back to the login when a sponsor set no name", () => {
		let roster = sponsorRoster(
			payload([
				{
					...node("ada", "PUBLIC"),
					sponsorEntity: { ...node("ada", "PUBLIC").sponsorEntity, name: null },
				},
			]),
		);

		expect(roster.current[0]?.name).toBe("ada");
	});

	test("skips a sponsorship whose sponsor the query could not read", () => {
		expect(sponsorRoster(payload([{ privacyLevel: "PUBLIC", sponsorEntity: null }]))).toEqual(
			NO_SPONSORS,
		);
	});

	test("names nobody when the payload is not the shape the query asks for", () => {
		expect(sponsorRoster({ errors: [{ message: "Bad credentials" }] })).toEqual(NO_SPONSORS);
		expect(sponsorRoster(null)).toEqual(NO_SPONSORS);
	});

	test("names nobody when the account has no sponsors", () => {
		expect(sponsorRoster({ data: { user: null } })).toEqual(NO_SPONSORS);
	});
});

describe("fetchSponsorRoster", () => {
	test("asks GitHub for the public view and keeps only public sponsorships", async () => {
		let asked: unknown = null;

		server.use(
			http.post(GRAPHQL_URL, async ({ request }) => {
				asked = await request.json();
				return HttpResponse.json(payload([node("ada", "PUBLIC"), node("grace", "PRIVATE")]));
			}),
		);

		let roster = await fetchSponsorRoster(TOKEN);
		let query = (asked as { query: string }).query;

		expect(logins(roster).current).toEqual(["ada"]);
		expect(query.match(/includePrivate: false/g)).toHaveLength(2);
		expect(query).toContain("activeOnly: true");
		expect(query).toContain("activeOnly: false");
	});

	test("asks for no field a narrower token cannot read", async () => {
		let asked: unknown = null;

		server.use(
			http.post(GRAPHQL_URL, async ({ request }) => {
				asked = await request.json();
				return HttpResponse.json(payload([]));
			}),
		);

		await fetchSponsorRoster(TOKEN);

		expect((asked as { query: string }).query).not.toContain("privacyLevel");
		expect((asked as { query: string }).query).not.toContain("isActive");
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

		await expect(fetchSponsorRoster(TOKEN)).rejects.toThrow("INSUFFICIENT_SCOPES");
	});

	test("reports nobody, and nothing invented, when the account has no sponsors", async () => {
		server.use(http.post(GRAPHQL_URL, () => HttpResponse.json(payload([]))));

		await expect(fetchSponsorRoster(TOKEN)).resolves.toEqual(NO_SPONSORS);
	});

	test("carries the credential", async () => {
		let authorization: string | null = null;

		server.use(
			http.post(GRAPHQL_URL, ({ request }) => {
				authorization = request.headers.get("authorization");
				return HttpResponse.json(payload([]));
			}),
		);

		await fetchSponsorRoster(TOKEN);

		expect(authorization).toBe(`Bearer ${TOKEN}`);
	});

	test("fails when GitHub refuses the query", async () => {
		server.use(http.post(GRAPHQL_URL, () => new HttpResponse(null, { status: 401 })));

		await expect(fetchSponsorRoster(TOKEN)).rejects.toThrow("401");
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

		expect(logins(await readStoredSponsors(cache))).toEqual({ current: ["ada"], past: [] });
	});

	test("leaves the stored list alone when GitHub cannot be read", async () => {
		server.use(http.post(GRAPHQL_URL, () => HttpResponse.error()));

		let cache = new MemoryCache();
		await cache.write(SPONSORS_CACHE_KEY, {
			current: [
				{
					login: "ada",
					name: "Ada",
					avatarUrl: "https://example.test/a",
					url: "https://example.test",
				},
			],
			past: [],
		});

		await expect(refreshSponsors(cache, TOKEN)).rejects.toThrow();
		expect(logins(await readStoredSponsors(cache)).current).toEqual(["ada"]);
	});
});

describe("readStoredSponsors", () => {
	test("names nobody when nothing has been stored", async () => {
		expect(await readStoredSponsors(new MemoryCache())).toEqual(NO_SPONSORS);
	});
});

describe("sponsorsTag", () => {
	test("changes when a sponsor moves from current to past", () => {
		let ada = { login: "ada", name: "Ada", avatarUrl: "", url: "" };

		expect(sponsorsTag({ current: [ada], past: [] })).not.toBe(
			sponsorsTag({ current: [], past: [ada] }),
		);
	});
});
