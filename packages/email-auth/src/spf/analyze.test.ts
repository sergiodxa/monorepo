/**
 * Covers the SPF audit: counting DNS-querying terms through includes and redirects with
 * RFC 7208 Appendix A.2's records as the fixture, and each problem the audit reports.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { serveZone } from "../fixtures/dns.js";

import { analyzeSpf } from "./analyze.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("analyzeSpf", () => {
	test("counts Appendix A.2's includes and the mechanisms behind them", async () => {
		serveZone(
			server,
			`$ORIGIN example.org.
@  TXT "v=spf1 include:example.com include:example.net -all"
la TXT "v=spf1 redirect=example.org"
$ORIGIN example.com.
@  TXT "v=spf1 a mx -all"
$ORIGIN example.net.
@  TXT "v=spf1 ip4:198.51.100.0/24 -all"`,
		);
		let audit = unwrap(await analyzeSpf("example.org"));
		expect(audit).toMatchObject({ status: "found", lookups: 4, problems: [] });
		expect(unwrap(await analyzeSpf("la.example.org")).lookups).toBe(5);
	});

	test("reports more than ten lookups and stops fetching once past them", async () => {
		let includes = Array.from({ length: 6 }, (_, index) => `include:i${index}.example.com`).join(
			" ",
		);
		let targets = Array.from({ length: 6 }, (_, index) => `i${index} TXT "v=spf1 a mx -all"`).join(
			"\n",
		);
		let queries = serveZone(server, `@ TXT "v=spf1 ${includes} -all"\n${targets}`);
		let audit = unwrap(await analyzeSpf("example.com"));
		expect(audit.lookups).toBeGreaterThan(10);
		expect(audit.problems[0]).toEqual({ code: "too-many-lookups", lookups: audit.lookups });
		expect(queries.length).toBeLessThan(7);
	});

	test("counts a macro target once without following it", async () => {
		serveZone(server, `@ TXT "v=spf1 include:%{ir}._spf.%{d} exists:%{i}.bl.%{d} -all"`);
		expect(unwrap(await analyzeSpf("example.com")).lookups).toBe(2);
	});

	test("does not count a redirect an all makes unreachable", async () => {
		serveZone(server, `@ TXT "v=spf1 -all redirect=example.org"`);
		expect(unwrap(await analyzeSpf("example.com")).lookups).toBe(0);
	});

	test.each([
		["none", "", "none", []],
		[
			"several records",
			`@ TXT "v=spf1 -all"\n@ TXT "v=spf1 +all"`,
			"multiple",
			[{ code: "multiple-records", domain: "example.com" }],
		],
	])("reads %s at the domain", async (_, zone, status, problems) => {
		serveZone(server, zone || "@ A 192.0.2.1");
		expect(unwrap(await analyzeSpf("example.com"))).toMatchObject({ status, problems });
	});

	test("reads a record that does not parse as invalid", async () => {
		serveZone(server, `@ TXT "v=spf1 foo -all"`);
		let audit = unwrap(await analyzeSpf("example.com"));
		expect(audit.status).toBe("invalid");
		expect(audit.problems[0]?.code).toBe("invalid-record");
	});

	test("reports include targets that are missing, duplicated, invalid or looping", async () => {
		serveZone(
			server,
			`@ TXT "v=spf1 include:gone.example.com include:twice.example.com include:bad.example.com include:loop.example.com -all"
twice TXT "v=spf1 -all"
twice TXT "v=spf1 +all"
bad TXT "v=spf1 ip4:300.0.0.1 -all"
loop TXT "v=spf1 include:example.com -all"`,
		);
		let audit = unwrap(await analyzeSpf("example.com"));
		expect(audit.problems.map((problem) => problem.code)).toEqual([
			"target-missing",
			"multiple-records",
			"invalid-record",
			"loop",
		]);
	});

	test("reports ptr and +all", async () => {
		serveZone(server, `@ TXT "v=spf1 ptr +all"`);
		expect(unwrap(await analyzeSpf("example.com")).problems).toEqual([
			{ code: "ptr-mechanism", domain: "example.com" },
			{ code: "permissive-all", domain: "example.com" },
		]);
	});

	test("reports a target the resolver failed on", async () => {
		serveZone(server, `@ TXT "v=spf1 include:example.net -all"`, { failing: ["example.net"] });
		expect(unwrap(await analyzeSpf("example.com")).problems[0]?.code).toBe("lookup-failed");
	});

	test("returns the failure when the domain's own lookup fails", async () => {
		serveZone(server, "", { failing: ["example.com"] });
		expect(isFailure(await analyzeSpf("example.com"))).toBe(true);
	});
});
