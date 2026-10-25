/**
 * Covers MTA-STS with RFC 8461's TXT record and policy file as fixtures: record and policy
 * grammar, §4.1's single-label wildcard matching, and fetching the policy over HTTPS with
 * redirects, statuses and media types a sender rejects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { serveZone } from "./fixtures/dns.js";
import {
	discoverMtaSts,
	fetchMtaStsPolicy,
	matchesMxPattern,
	parseMtaStsPolicy,
	parseMtaStsRecord,
} from "./mta-sts.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** RFC 8461 §3.2's example policy, CRLF-terminated as the section specifies. */
const RFC8461_POLICY = [
	"version: STSv1",
	"mode: enforce",
	"mx: mail.example.com",
	"mx: *.example.net",
	"mx: backupmx.example.com",
	"max_age: 604800",
	"",
].join("\r\n");

const POLICY_URL = "https://mta-sts.example.com/.well-known/mta-sts.txt";

describe("parseMtaStsRecord", () => {
	test("reads RFC 8461 §3.1's example", () => {
		expect(unwrap(parseMtaStsRecord("v=STSv1; id=20160831085700Z;")).id).toBe("20160831085700Z");
	});

	test.each([
		["v=STSv2; id=1", "v=STSv1"],
		["v=STSv1;", "no `id`"],
		["v=STSv1; id=has-dash", "letters and digits"],
		["v=STSv1; id=123456789012345678901234567890123", "letters and digits"],
	])("rejects %s", (text, message) => {
		let record = parseMtaStsRecord(text);
		expect(isFailure(record) && record.error.message).toContain(message);
	});
});

describe("parseMtaStsPolicy", () => {
	test("reads RFC 8461 §3.2's example policy", () => {
		expect(unwrap(parseMtaStsPolicy(RFC8461_POLICY))).toMatchObject({
			mode: "enforce",
			mx: ["mail.example.com", "*.example.net", "backupmx.example.com"],
			maxAge: 604800,
		});
	});

	test("accepts LF line ends and ignores unknown fields", () => {
		let policy = parseMtaStsPolicy(
			"version: STSv1\nmode: testing\nmx: mx.example.com\nmax_age: 86400\nnew_field: x\n",
		);
		expect(unwrap(policy).mode).toBe("testing");
	});

	test("keeps the first of a repeated field", () => {
		let policy = parseMtaStsPolicy(
			"version: STSv1\nmode: testing\nmode: enforce\nmx: mx.example.com\nmax_age: 1\n",
		);
		expect(unwrap(policy).mode).toBe("testing");
	});

	test("allows mode none without an mx", () => {
		expect(unwrap(parseMtaStsPolicy("version: STSv1\nmode: none\nmax_age: 86400\n")).mx).toEqual(
			[],
		);
	});

	test.each([
		["mode: enforce\nmx: a.example.com\nmax_age: 1", "version"],
		["version: STSv1\nmode: strict\nmx: a.example.com\nmax_age: 1", "`mode`"],
		["version: STSv1\nmode: enforce\nmx: a.example.com\nmax_age: 31557601", "max_age"],
		["version: STSv1\nmode: enforce\nmax_age: 1", "needs an `mx`"],
		["version: STSv1\nmode: enforce\nmx: *.*.example.com\nmax_age: 1", "MX pattern"],
		["<html>", "key: value"],
	])("rejects %j", (text, message) => {
		let policy = parseMtaStsPolicy(text);
		expect(isFailure(policy) && policy.error.message).toContain(message);
	});
});

describe("matchesMxPattern", () => {
	let patterns = ["mail.example.com", "*.example.net"];

	test.each([
		["mail.example.com", true],
		["MAIL.example.com.", true],
		["mx1.example.net", true],
		["example.net", false],
		["foo.bar.example.net", false],
		["other.example.com", false],
	])("%s is %s", (host, expected) => {
		expect(matchesMxPattern(host, patterns)).toBe(expected);
	});
});

describe("discoverMtaSts", () => {
	test("finds the record and ignores non-STS TXT records beside it", async () => {
		serveZone(server, `_mta-sts IN TXT "v=STSv1; id=20160831085700Z;"\n_mta-sts IN TXT "other"`);
		let found = unwrap(await discoverMtaSts("example.com"));
		expect(found.status === "found" && found.record.id).toBe("20160831085700Z");
	});

	test("reads an invalid record as invalid", async () => {
		serveZone(server, `_mta-sts IN TXT "v=STSv1; id=bad_id"`);
		expect(unwrap(await discoverMtaSts("example.com")).status).toBe("invalid");
	});
});

describe("fetchMtaStsPolicy", () => {
	test("fetches and parses the policy file", async () => {
		server.use(
			http.get(POLICY_URL, () =>
				HttpResponse.text(RFC8461_POLICY, {
					headers: { "content-type": "text/plain; charset=utf-8" },
				}),
			),
		);
		expect(unwrap(await fetchMtaStsPolicy("example.com")).mode).toBe("enforce");
	});

	test("refuses to follow a redirect", async () => {
		server.use(
			http.get(POLICY_URL, () =>
				HttpResponse.text("", {
					status: 301,
					headers: { location: "https://elsewhere.com/p.txt" },
				}),
			),
		);
		let policy = await fetchMtaStsPolicy("example.com");
		expect(isFailure(policy) && policy.error.reason).toBe("request");
	});

	test("rejects a status other than 200", async () => {
		server.use(http.get(POLICY_URL, () => HttpResponse.text("missing", { status: 404 })));
		let policy = await fetchMtaStsPolicy("example.com");
		expect(isFailure(policy) && policy.error).toMatchObject({ reason: "status", status: 404 });
	});

	test("rejects a body that is not text/plain", async () => {
		server.use(http.get(POLICY_URL, () => HttpResponse.html("<p>policy</p>")));
		let policy = await fetchMtaStsPolicy("example.com");
		expect(isFailure(policy) && policy.error.reason).toBe("content-type");
	});

	test("rejects a body over 64 KiB", async () => {
		server.use(
			http.get(POLICY_URL, () =>
				HttpResponse.text("x".repeat(70_000), { headers: { "content-type": "text/plain" } }),
			),
		);
		let policy = await fetchMtaStsPolicy("example.com");
		expect(isFailure(policy) && policy.error.reason).toBe("request");
	});

	test("rejects a policy file that does not parse", async () => {
		server.use(
			http.get(POLICY_URL, () =>
				HttpResponse.text("version: STSv1\n", { headers: { "content-type": "text/plain" } }),
			),
		);
		let policy = await fetchMtaStsPolicy("example.com");
		expect(isFailure(policy) && policy.error.reason).toBe("invalid");
	});
});
