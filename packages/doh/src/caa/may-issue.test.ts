/**
 * Covers `mayIssue`: a decided verdict carries the RRset that decided it, a failing lookup
 * reads as `allowed: false` with the name that failed, an unparsable record refuses, and
 * the caller's resolver reaches every query of the climb.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { ServerFailureError } from "../errors.js";
import { CLOUDFLARE, GOOGLE } from "../resolvers.js";

import { mayIssue } from "./may-issue.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Answers CAA queries at `url` from `answers`, by queried name, NXDOMAIN for any other,
 * and returns the names asked in order.
 */
function answer(
	answers: Record<string, { Status?: number; data?: string[] }>,
	url = CLOUDFLARE.url,
) {
	let queried: string[] = [];
	server.use(
		http.get(url, ({ request }) => {
			let name = new URL(request.url).searchParams.get("name") ?? "";
			queried.push(name);
			let { Status = 3, data = [] } = answers[name] ?? {};
			return HttpResponse.json({
				Status,
				AD: false,
				Answer: data.map((line) => ({ name, type: 257, TTL: 300, data: line })),
			});
		}),
	);
	return queried;
}

describe("mayIssue", () => {
	test("decides against the relevant RRset and reports where it lives", async () => {
		answer({ "example.com": { Status: 0, data: ['0 issue "digicert.com"'] } });

		let verdict = await mayIssue({ domain: "*.example.com", issuer: "letsencrypt.org" });

		expect(verdict).toMatchObject({
			allowed: false,
			reason: "not-authorized",
			issuers: ["digicert.com"],
			relevant: { name: "example.com", queried: ["example.com"] },
		});
	});

	test("allows a name with no policy anywhere up the tree", async () => {
		answer({});
		let verdict = await mayIssue({ domain: "shop.example.com", issuer: "letsencrypt.org" });
		expect(verdict).toMatchObject({ allowed: true, reason: "no-policy" });
	});

	test("refuses a failing lookup, naming the query that failed", async () => {
		answer({ "example.com": { Status: 2 } });

		let verdict = await mayIssue({ domain: "shop.example.com", issuer: "letsencrypt.org" });

		expect(verdict.allowed).toBe(false);
		expect(verdict.reason).toBe("lookup-failed");
		if (verdict.reason !== "lookup-failed") return;
		expect(verdict.name).toBe("example.com");
		expect(verdict.queried).toEqual(["shop.example.com", "example.com"]);
		expect(verdict.error).toBeInstanceOf(ServerFailureError);
	});

	test("refuses a set holding an unparsable record before reading any property", async () => {
		answer({ "example.com": { Status: 0, data: ['0 issue "letsencrypt.org"', "garbage"] } });

		let verdict = await mayIssue({ domain: "example.com", issuer: "letsencrypt.org" });

		expect(verdict).toMatchObject({
			allowed: false,
			reason: "unreadable",
			record: { name: "example.com", type: "CAA", data: "garbage" },
		});
	});

	test("sends every query of the climb to the caller's resolver", async () => {
		let queried = answer(
			{ "example.com": { Status: 0, data: ['0 issue "letsencrypt.org"'] } },
			GOOGLE.url,
		);

		let verdict = await mayIssue(
			{ domain: "a.b.example.com", issuer: "letsencrypt.org" },
			{ resolver: GOOGLE },
		);

		expect(verdict).toMatchObject({ allowed: true, reason: "authorized" });
		expect(queried).toEqual(["a.b.example.com", "b.example.com", "example.com"]);
	});
});
