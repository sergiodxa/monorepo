/**
 * Exercises robots.txt retrieval against RFC 9309 §2.3: a 2xx parsed, a 4xx read as unavailable
 * (allow all), a 5xx, 429 or network failure read as unreachable (disallow all), redirects up to
 * the limit, the parsing limit, and the lifetimes a cache gives each outcome.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { RobotsFetch } from "./fetch.js";

import { fetchRobots, isAllowedBy } from "./fetch.js";

import { parse } from "./index.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** The agent every retrieval in this file names itself as. */
const AGENT = "SergioReader/1.0 (+https://sergiodxa.com/bot)";

/** The file every retrieval in this file asks for. */
const ROBOTS = "https://example.com/robots.txt";

/** One day, the lifetime RFC 9309 §2.4 caps a cached file at. */
const DAY_MS = 86_400_000;

/** One hour, the lifetime of an unreachable outcome. */
const HOUR_MS = 3_600_000;

describe(fetchRobots, () => {
	test("parses a 200, sending the agent and asking for plain text", async () => {
		let headers: Headers | undefined;
		server.use(
			http.get(ROBOTS, ({ request }) => {
				headers = request.headers;
				return HttpResponse.text("User-agent: *\nDisallow: /private\n");
			}),
		);

		let outcome = await fetchRobots("https://example.com/post/1", { userAgent: AGENT });

		expect(outcome).toEqual({
			status: "parsed",
			document: parse("User-agent: *\nDisallow: /private\n"),
			lifetimeMs: DAY_MS,
		});
		expect(headers?.get("user-agent")).toBe(AGENT);
		expect(headers?.get("accept")).toBe("text/plain");
	});

	test.each([400, 401, 403, 404, 410])(
		"reads a %i as unavailable, which allows everything",
		async (status) => {
			server.use(http.get(ROBOTS, () => new HttpResponse(null, { status })));

			let outcome = await fetchRobots(ROBOTS, { userAgent: AGENT });

			expect(outcome).toEqual({ status: "unavailable", httpStatus: status, lifetimeMs: DAY_MS });
			expect(isAllowedBy(outcome, AGENT, "https://example.com/anything")).toBe(true);
		},
	);

	test.each([429, 500, 502, 503])(
		"reads a %i as unreachable, which disallows everything",
		async (status) => {
			server.use(http.get(ROBOTS, () => new HttpResponse(null, { status })));

			let outcome = await fetchRobots(ROBOTS, { userAgent: AGENT });

			expect(outcome).toEqual({ status: "unreachable", httpStatus: status, lifetimeMs: HOUR_MS });
			expect(isAllowedBy(outcome, AGENT, "https://example.com/anything")).toBe(false);
		},
	);

	test("reads a network failure as unreachable with no status", async () => {
		server.use(http.get(ROBOTS, () => HttpResponse.error()));

		expect(await fetchRobots(ROBOTS, { userAgent: AGENT })).toEqual({
			status: "unreachable",
			httpStatus: null,
			lifetimeMs: HOUR_MS,
		});
	});

	test("reads a timeout as unreachable", async () => {
		server.use(
			http.get(ROBOTS, async () => {
				await new Promise((resolve) => setTimeout(resolve, 200));
				return HttpResponse.text("User-agent: *\nAllow: /\n");
			}),
		);

		let outcome = await fetchRobots(ROBOTS, { userAgent: AGENT, timeoutMs: 20 });
		expect(outcome.status).toBe("unreachable");
	});

	test("reads a caller's abort as unreachable", async () => {
		server.use(http.get(ROBOTS, () => HttpResponse.text("User-agent: *\nAllow: /\n")));

		let outcome = await fetchRobots(ROBOTS, { userAgent: AGENT, signal: AbortSignal.abort() });
		expect(outcome.status).toBe("unreachable");
	});

	test("reads text that is not a URL as unreachable", async () => {
		expect((await fetchRobots("not a url", { userAgent: AGENT })).status).toBe("unreachable");
	});

	/** Serves a chain of `hops` redirects from example.com to the file on its last host. */
	function redirectChain(hops: number) {
		let handlers = [];
		for (let hop = 0; hop < hops; hop++) {
			let from = hop === 0 ? ROBOTS : `https://hop${hop}.example.com/robots.txt`;
			let to = `https://hop${hop + 1}.example.com/robots.txt`;
			handlers.push(
				http.get(from, () => new HttpResponse(null, { status: 301, headers: { location: to } })),
			);
		}
		handlers.push(
			http.get(`https://hop${hops}.example.com/robots.txt`, () =>
				HttpResponse.text("User-agent: *\nDisallow: /private\n"),
			),
		);
		server.use(...handlers);
	}

	test("follows five redirects, even across hosts (§2.3.1.2)", async () => {
		redirectChain(5);

		let outcome = await fetchRobots(ROBOTS, { userAgent: AGENT });

		expect(outcome.status).toBe("parsed");
		expect(isAllowedBy(outcome, AGENT, "https://example.com/private/x")).toBe(false);
	});

	test("reads a sixth redirect as unreachable", async () => {
		redirectChain(6);
		expect((await fetchRobots(ROBOTS, { userAgent: AGENT })).status).toBe("unreachable");
	});

	test("honours a custom redirect limit", async () => {
		redirectChain(2);
		expect((await fetchRobots(ROBOTS, { userAgent: AGENT, maxRedirects: 1 })).status).toBe(
			"unreachable",
		);
	});

	test("resolves a relative Location against the address that sent it", async () => {
		server.use(
			http.get(
				ROBOTS,
				() => new HttpResponse(null, { status: 302, headers: { location: "/rules.txt" } }),
			),
			http.get("https://example.com/rules.txt", () =>
				HttpResponse.text("User-agent: *\nDisallow: /\n"),
			),
		);

		expect((await fetchRobots(ROBOTS, { userAgent: AGENT })).status).toBe("parsed");
	});

	test("reads a redirect with no Location as unreachable", async () => {
		server.use(http.get(ROBOTS, () => new HttpResponse(null, { status: 302 })));
		expect((await fetchRobots(ROBOTS, { userAgent: AGENT })).status).toBe("unreachable");
	});

	test("parses the whole lines within maxBytes and ignores the rest", async () => {
		server.use(
			http.get(ROBOTS, () =>
				HttpResponse.text("User-agent: *\nDisallow: /a\nDisallow: /bcdefgh\n"),
			),
		);

		let outcome = await fetchRobots(ROBOTS, { userAgent: AGENT, maxBytes: 30 });

		expect(outcome.status === "parsed" && outcome.document.groups[0]?.rules).toEqual([
			{ allow: false, pattern: "/a" },
		]);
	});

	test("drops a leading byte order mark", async () => {
		server.use(http.get(ROBOTS, () => HttpResponse.text("﻿User-agent: *\nDisallow: /\n")));

		let outcome = await fetchRobots(ROBOTS, { userAgent: AGENT });
		expect(outcome.status === "parsed" && outcome.document.groups[0]?.userAgents).toEqual(["*"]);
	});

	test("produces plain data a cache can store as JSON and evaluate later", async () => {
		server.use(http.get(ROBOTS, () => HttpResponse.text("User-agent: *\nDisallow: /x\n")));

		let outcome = await fetchRobots(ROBOTS, { userAgent: AGENT });
		let stored = JSON.parse(JSON.stringify(outcome)) as RobotsFetch.Outcome;

		expect(stored).toEqual(outcome);
		expect(isAllowedBy(stored, AGENT, "https://example.com/x")).toBe(false);
	});
});

describe(isAllowedBy, () => {
	test("evaluates a parsed document", () => {
		let outcome: RobotsFetch.Outcome = {
			status: "parsed",
			document: parse("User-agent: *\nDisallow: /a\n"),
			lifetimeMs: DAY_MS,
		};

		expect(isAllowedBy(outcome, AGENT, "https://example.com/a")).toBe(false);
		expect(isAllowedBy(outcome, AGENT, "https://example.com/b")).toBe(true);
	});

	test("lets an agent read robots.txt itself even while the origin is unreachable", () => {
		let outcome: RobotsFetch.Outcome = {
			status: "unreachable",
			httpStatus: 503,
			lifetimeMs: HOUR_MS,
		};
		expect(isAllowedBy(outcome, AGENT, "https://example.com/robots.txt")).toBe(true);
	});
});
