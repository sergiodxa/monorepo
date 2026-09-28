/**
 * Exercises the link-blocklist check against DoH JSON answers served through MSW: each zone's
 * return codes, the refusal codes that mean misconfiguration, host selection, and resolver
 * failures.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { CLOUDFLARE } from "@sdxc/doh";
import { isFailure, success, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { Signal, SpamCheckError, Submission } from "./check.js";

import { linkBlocklist } from "./link-blocklist.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/**
 * Answers DoH queries from `listings`, query name to `A` addresses; any other name is NXDOMAIN.
 * Returns the names queried, in order.
 */
function zonesAnswer(listings: Record<string, string[]>) {
	let queried: string[] = [];
	server.use(
		http.get(CLOUDFLARE.url, ({ request }) => {
			let name = new URL(request.url).searchParams.get("name") ?? "";
			queried.push(name);
			let addresses = listings[name];
			if (addresses === undefined) return HttpResponse.json({ Status: 3 });
			return HttpResponse.json({
				Status: 0,
				Answer: addresses.map((data) => ({ name: `${name}.`, type: 1, TTL: 300, data })),
			});
		}),
	);
	return queried;
}

/** Runs the check with a fresh abort signal, as the filter would. */
async function run(
	submission: Submission,
	options?: linkBlocklist.Options,
): Promise<Result<Signal[], SpamCheckError>> {
	let answer = await linkBlocklist(options).check(submission, {
		signal: new AbortController().signal,
		score: 0,
		signals: [],
	});
	return Array.isArray(answer) ? success(answer) : answer;
}

/** The failure of a run, `null` when it succeeded. */
async function errorOf(
	submission: Submission,
	options?: linkBlocklist.Options,
): Promise<SpamCheckError | null> {
	let outcome = await run(submission, options);
	return isFailure(outcome) ? outcome.error : null;
}

describe("linkBlocklist", () => {
	test("scores a domain SURBL and URIBL list", async () => {
		zonesAnswer({
			"spam.example.multi.surbl.org": ["127.0.0.24"],
			"spam.example.multi.uribl.com": ["127.0.0.2"],
		});
		let signals = unwrap(await run({ content: "buy at https://shop.spam.example/now" }));
		expect(signals).toEqual([
			{
				check: "link-blocklist.surbl",
				score: 6,
				detail: "spam.example is listed by SURBL (phishing, malware)",
			},
			{
				check: "link-blocklist.uribl",
				score: 6,
				detail: "spam.example is listed by URIBL (black)",
			},
		]);
	});

	test("answers nothing for clean domains", async () => {
		let queried = zonesAnswer({});
		let content = "see https://example.com and www.example.org";
		expect(unwrap(await run({ content }))).toEqual([]);
		expect(queried.sort()).toEqual([
			"example.com.multi.surbl.org",
			"example.com.multi.uribl.com",
			"example.org.multi.surbl.org",
			"example.org.multi.uribl.com",
		]);
	});

	test("scores a URIBL grey listing as weak", async () => {
		zonesAnswer({ "grey.example.multi.uribl.com": ["127.0.0.4"] });
		expect(unwrap(await run({ content: "https://grey.example" }))).toMatchObject([
			{ check: "link-blocklist.uribl", score: 2 },
		]);
	});

	test("queries Spamhaus through DQS when a key is given", async () => {
		let queried = zonesAnswer({
			"spam.example.KEY.dbl.dq.spamhaus.net": ["127.0.1.2"],
			"abused.example.KEY.dbl.dq.spamhaus.net": ["127.0.1.102"],
		});
		let signals = unwrap(
			await run(
				{ content: "https://spam.example https://abused.example" },
				{ dqsKey: "KEY", zones: ["spamhaus"] },
			),
		);
		expect(signals).toEqual([
			{
				check: "link-blocklist.spamhaus",
				score: 6,
				detail: "spam.example is listed by Spamhaus DBL (spam)",
			},
			{
				check: "link-blocklist.spamhaus",
				score: 2,
				detail: "abused.example is listed by Spamhaus DBL (abused spam)",
			},
		]);
		expect(queried).toHaveLength(2);
	});

	test("adds Spamhaus to the default zones only with a key", async () => {
		let queried = zonesAnswer({});
		await run({ content: "https://example.com" }, { dqsKey: "KEY" });
		expect(queried.sort()).toEqual([
			"example.com.KEY.dbl.dq.spamhaus.net",
			"example.com.multi.surbl.org",
			"example.com.multi.uribl.com",
		]);
	});

	test("fails misconfigured when Spamhaus is chosen without a key", async () => {
		let queried = zonesAnswer({});
		let error = await errorOf({ content: "https://example.com" }, { zones: ["spamhaus"] });
		expect(error?.code).toBe("misconfigured");
		expect(queried).toEqual([]);
	});

	test.each([
		["spamhaus", "example.com.KEY.dbl.dq.spamhaus.net", "127.255.255.254"],
		["spamhaus", "example.com.KEY.dbl.dq.spamhaus.net", "127.255.255.255"],
		["spamhaus", "example.com.KEY.dbl.dq.spamhaus.net", "127.255.255.252"],
		["surbl", "example.com.multi.surbl.org", "127.0.0.1"],
		["uribl", "example.com.multi.uribl.com", "127.0.0.1"],
	] as const)("reads %s's %s answer %s as a refused query", async (zone, name, address) => {
		zonesAnswer({ [name]: [address] });
		let error = await errorOf({ content: "https://example.com" }, { dqsKey: "KEY", zones: [zone] });
		expect(error?.code).toBe("misconfigured");
	});

	test("keeps listings found even when another zone refused the query", async () => {
		zonesAnswer({
			"spam.example.multi.surbl.org": ["127.0.0.64"],
			"spam.example.multi.uribl.com": ["127.0.0.1"],
		});
		expect(unwrap(await run({ content: "https://spam.example" }))).toMatchObject([
			{ check: "link-blocklist.surbl", detail: "spam.example is listed by SURBL (abuse)" },
		]);
	});

	test("fails invalid-response on an address outside 127.0.0.0/8", async () => {
		zonesAnswer({ "example.com.multi.surbl.org": ["198.51.100.1"] });
		let error = await errorOf({ content: "https://example.com" }, { zones: ["surbl"] });
		expect(error?.code).toBe("invalid-response");
	});

	test("fails unavailable when the resolver fails", async () => {
		server.use(http.get(CLOUDFLARE.url, () => HttpResponse.json({ Status: 2 })));
		expect((await errorOf({ content: "https://example.com" }))?.code).toBe("unavailable");

		server.use(http.get(CLOUDFLARE.url, () => new HttpResponse(null, { status: 502 })));
		expect((await errorOf({ content: "https://example.com" }))?.code).toBe("unavailable");
	});

	test("reduces hosts to their registrable domain and includes the author's URL", async () => {
		let queried = zonesAnswer({});
		await run(
			{
				content: "https://a.shop.example.co.uk https://www.example.co.uk/x",
				author: { url: "https://blog.author.example" },
			},
			{ zones: ["surbl"] },
		);
		expect(queried.sort()).toEqual([
			"author.example.multi.surbl.org",
			"example.co.uk.multi.surbl.org",
		]);
	});

	test("skips IP literals and makes no request without domains", async () => {
		let queried = zonesAnswer({});
		expect(unwrap(await run({ content: "http://203.0.113.9/x http://[2001:db8::1]/" }))).toEqual(
			[],
		);
		expect(unwrap(await run({ content: "no links at all" }))).toEqual([]);
		expect(queried).toEqual([]);
	});

	test("caps the domains looked up and the total score", async () => {
		let hosts = Array.from({ length: 15 }, (_, index) => `spam${index}.example`);
		let queried = zonesAnswer(
			Object.fromEntries(hosts.map((host) => [`${host}.multi.surbl.org`, ["127.0.0.8"]])),
		);
		let signals = unwrap(
			await run(
				{ content: hosts.map((host) => `https://${host}`).join(" ") },
				{ zones: ["surbl"] },
			),
		);
		expect(queried).toHaveLength(10);
		expect(signals.reduce((sum, signal) => sum + signal.score, 0)).toBe(12);
		expect(signals).toHaveLength(2);
	});
});
