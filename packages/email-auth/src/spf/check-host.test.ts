/**
 * Covers `check_host()` against RFC 7208 Appendix A's DNS, served as a zone: each A.1
 * record with the hosts it lets pass, A.2's include and redirect, A.3's DNSBL-style
 * `exists`, A.4's negated includes, the lookup limits and `exp` explanations.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { serveZone } from "../fixtures/dns.js";

import { checkHost } from "./check-host.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** RFC 7208 Appendix A's DNS setup, verbatim. */
const APPENDIX_A_ZONE = `
$ORIGIN example.com.
@           MX  10 mail-a
            MX  20 mail-b
            A   192.0.2.10
            A   192.0.2.11
amy         A   192.0.2.65
bob         A   192.0.2.66
mail-a      A   192.0.2.129
mail-b      A   192.0.2.130
www         CNAME example.com.
$ORIGIN example.org.
@           MX  10 mail-c
mail-c      A   192.0.2.140
$ORIGIN 2.0.192.in-addr.arpa.
10          PTR example.com.
11          PTR example.com.
65          PTR amy.example.com.
66          PTR bob.example.com.
129         PTR mail-a.example.com.
130         PTR mail-b.example.com.
140         PTR mail-c.example.org.
$ORIGIN 0.0.10.in-addr.arpa.
4           PTR bob.example.com.
`;

/** Serves Appendix A's DNS with `records` added as zone lines. */
function serve(records: string, options: { failing?: string[] } = {}): string[] {
	return serveZone(server, `${APPENDIX_A_ZONE}\n${records}`, {
		origin: "example.com.",
		...options,
	});
}

/** Checks `ip` against example.com's policy. */
async function check(ip: string, domain = "example.com") {
	return checkHost({ ip, domain, sender: `user@${domain}` });
}

describe("Appendix A.1", () => {
	test.each([
		["v=spf1 +all", "198.51.100.1", "pass"],
		["v=spf1 a -all", "192.0.2.10", "pass"],
		["v=spf1 a -all", "192.0.2.11", "pass"],
		["v=spf1 a -all", "192.0.2.65", "fail"],
		["v=spf1 a:example.org -all", "192.0.2.140", "fail"],
		["v=spf1 mx -all", "192.0.2.129", "pass"],
		["v=spf1 mx -all", "192.0.2.130", "pass"],
		["v=spf1 mx -all", "192.0.2.140", "fail"],
		["v=spf1 mx:example.org -all", "192.0.2.140", "pass"],
		["v=spf1 mx mx:example.org -all", "192.0.2.140", "pass"],
		["v=spf1 mx mx:example.org -all", "192.0.2.129", "pass"],
		["v=spf1 mx/30 mx:example.org/30 -all", "192.0.2.131", "pass"],
		["v=spf1 mx/30 mx:example.org/30 -all", "192.0.2.142", "pass"],
		["v=spf1 mx/30 mx:example.org/30 -all", "192.0.2.144", "fail"],
		["v=spf1 ptr -all", "192.0.2.65", "pass"],
		["v=spf1 ptr -all", "192.0.2.140", "fail"],
		["v=spf1 ptr -all", "10.0.0.4", "fail"],
		["v=spf1 ip4:192.0.2.128/28 -all", "192.0.2.65", "fail"],
		["v=spf1 ip4:192.0.2.128/28 -all", "192.0.2.129", "pass"],
	])("%s gives %s a %s", async (record, ip, expected) => {
		serve(`$ORIGIN example.com.\n@ TXT "${record}"`);
		expect((await check(ip)).result).toBe(expected);
	});
});

describe("Appendix A.2", () => {
	let zone = `
$ORIGIN example.org.
@  TXT "v=spf1 include:example.com include:example.net -all"
la TXT "v=spf1 redirect=example.org"
$ORIGIN example.com.
@  TXT "v=spf1 a -all"
$ORIGIN example.net.
@  TXT "v=spf1 ip4:198.51.100.0/24 -all"
`;

	test("passes a host one include authorizes", async () => {
		serve(zone);
		let evaluation = await check("198.51.100.7", "example.org");
		expect(evaluation).toMatchObject({ result: "pass", mechanism: "include:example.net" });
		expect(evaluation.lookups).toBe(3);
	});

	test("fails a host neither include authorizes", async () => {
		serve(zone);
		expect((await check("203.0.113.1", "example.org")).result).toBe("fail");
	});

	test("follows a redirect to the shared policy", async () => {
		serve(zone);
		let evaluation = await check("192.0.2.10", "la.example.org");
		expect(evaluation).toMatchObject({ result: "pass", mechanism: "include:example.com" });
		expect(evaluation.lookups).toBe(3);
	});
});

describe("Appendix A.3", () => {
	let zone = `
$ORIGIN example.com.
@ TXT "v=spf1 mx include:mobile-users._spf.%{d} include:remote-users._spf.%{d} -all"
mobile-users._spf TXT "v=spf1 exists:%{l1r+}.%{d}"
remote-users._spf TXT "v=spf1 exists:%{ir}.%{l1r+}.%{d}"
$ORIGIN _spf.example.com.
mary.mobile-users                   A 127.0.0.2
fred.mobile-users                   A 127.0.0.2
15.15.168.192.joel.remote-users     A 127.0.0.2
16.15.168.192.joel.remote-users     A 127.0.0.2
`;

	test("passes a mobile user from any address", async () => {
		serve(zone);
		let evaluation = await checkHost({
			ip: "203.0.113.9",
			domain: "example.com",
			sender: "mary@example.com",
		});
		expect(evaluation.result).toBe("pass");
	});

	test("passes a remote user only from their own server", async () => {
		serve(zone);
		let from = (ip: string) => checkHost({ ip, domain: "example.com", sender: "joel@example.com" });
		expect((await from("192.168.15.15")).result).toBe("pass");
		expect((await from("192.168.15.17")).result).toBe("fail");
	});
});

describe("Appendix A.4", () => {
	let zone = `
$ORIGIN example.com.
@ TXT "v=spf1 -include:ip4._spf.%{d} -include:ptr._spf.%{d} +all"
ip4._spf TXT "v=spf1 -ip4:192.0.2.0/24 +all"
ptr._spf TXT "v=spf1 -ptr +all"
`;

	test("checks ptr against the included domain, so an in-range host still fails", async () => {
		serve(zone);
		expect(await check("192.0.2.65")).toMatchObject({
			result: "fail",
			mechanism: "-include:ptr._spf.%{d}",
		});
	});

	test("fails a host outside the range", async () => {
		serve(zone);
		expect((await check("198.51.100.1")).result).toBe("fail");
	});
});

describe("results without a match", () => {
	test("is none without a record", async () => {
		serve("");
		expect((await check("192.0.2.10")).result).toBe("none");
	});

	test("is neutral when nothing matches and no all or redirect decides", async () => {
		serve(`$ORIGIN example.com.\n@ TXT "v=spf1 ip4:198.51.100.0/24"`);
		expect((await check("192.0.2.10")).result).toBe("neutral");
	});

	test("is softfail for ~all and neutral for ?all", async () => {
		serve(`$ORIGIN example.com.\n@ TXT "v=spf1 ~all"\nsub TXT "v=spf1 ?all"`);
		expect((await check("192.0.2.10")).result).toBe("softfail");
		expect((await check("192.0.2.10", "sub.example.com")).result).toBe("neutral");
	});

	test("ignores a redirect when the record has an all", async () => {
		let queries = serve(`$ORIGIN example.com.\n@ TXT "v=spf1 ?all redirect=example.org"`);
		expect((await check("192.0.2.10")).result).toBe("neutral");
		expect(queries).not.toContain("example.org/TXT");
	});
});

describe("errors", () => {
	test("is permerror with two SPF records", async () => {
		serve(`$ORIGIN example.com.\n@ TXT "v=spf1 -all"\n@ TXT "v=spf1 +all"`);
		expect((await check("192.0.2.10")).result).toBe("permerror");
	});

	test("is permerror for a syntax error", async () => {
		serve(`$ORIGIN example.com.\n@ TXT "v=spf1 a:localhost -all"`);
		expect((await check("192.0.2.10")).result).toBe("permerror");
	});

	test("is permerror for an include without a record", async () => {
		serve(`$ORIGIN example.com.\n@ TXT "v=spf1 include:example.org -all"`);
		let evaluation = await check("192.0.2.10");
		expect(evaluation.result).toBe("permerror");
		expect(evaluation.problem).toContain("example.org");
	});

	test("is temperror when the resolver fails", async () => {
		serve(`$ORIGIN example.com.\n@ TXT "v=spf1 include:example.org -all"`, {
			failing: ["example.org"],
		});
		expect((await check("192.0.2.10")).result).toBe("temperror");
	});

	test("is permerror past ten DNS-querying terms", async () => {
		let includes = Array.from({ length: 11 }, (_, index) => `include:i${index}.example.com`).join(
			" ",
		);
		let targets = Array.from({ length: 11 }, (_, index) => `i${index} TXT "v=spf1 -all"`).join(
			"\n",
		);
		serve(`$ORIGIN example.com.\n@ TXT "v=spf1 ${includes} -all"\n${targets}`);
		let evaluation = await check("192.0.2.10");
		expect(evaluation).toMatchObject({ result: "permerror", lookups: 11 });
	});

	test("passes at exactly ten", async () => {
		let terms = Array.from({ length: 9 }, (_, index) => `a:h${index}.example.com`).join(" ");
		let hosts = Array.from({ length: 9 }, (_, index) => `h${index} A 192.0.2.${index + 1}`).join(
			"\n",
		);
		serve(`$ORIGIN example.com.\n@ TXT "v=spf1 ${terms} mx -all"\n${hosts}`);
		let evaluation = await check("192.0.2.129");
		expect(evaluation).toMatchObject({ result: "pass", lookups: 10 });
	});

	test("is permerror after the third void lookup", async () => {
		serve(
			`$ORIGIN example.com.\n@ TXT "v=spf1 a:x1.example.com a:x2.example.com a:x3.example.com -all"`,
		);
		let evaluation = await check("192.0.2.10");
		expect(evaluation).toMatchObject({ result: "permerror", voidLookups: 3 });
	});

	test("allows a configured void lookup limit", async () => {
		serve(
			`$ORIGIN example.com.\n@ TXT "v=spf1 a:x1.example.com a:x2.example.com a:x3.example.com -all"`,
		);
		let evaluation = await checkHost(
			{ ip: "192.0.2.10", domain: "example.com", sender: "user@example.com" },
			{ maxVoidLookups: 5 },
		);
		expect(evaluation.result).toBe("fail");
	});

	test("is permerror for an address that does not parse", async () => {
		expect((await check("not-an-ip")).result).toBe("permerror");
	});

	test("is none for a name that is not a domain", async () => {
		expect((await check("192.0.2.10", "localhost")).result).toBe("none");
	});
});

describe("explanations", () => {
	test("expands exp on a fail", async () => {
		serve(`$ORIGIN example.com.
@ TXT "v=spf1 mx -all exp=explain._spf.%{d}"
explain._spf TXT "%{i} is not one of %{d}'s designated mail servers."`);
		let evaluation = await check("203.0.113.5");
		expect(evaluation).toMatchObject({
			result: "fail",
			mechanism: "-all",
			explanation: "203.0.113.5 is not one of example.com's designated mail servers.",
		});
	});

	test("leaves a pass without one", async () => {
		serve(`$ORIGIN example.com.\n@ TXT "v=spf1 mx -all exp=explain._spf.%{d}"`);
		expect((await check("192.0.2.129")).explanation).toBeNull();
	});
});

describe("IPv6 and senders", () => {
	test("matches an ip6 network", async () => {
		serve(`$ORIGIN example.com.\n@ TXT "v=spf1 ip6:2001:db8::/32 -all"`);
		expect((await check("2001:db8::cb01")).result).toBe("pass");
		expect((await check("2001:db9::1")).result).toBe("fail");
	});

	test("reads an IPv4-mapped address as IPv4", async () => {
		serve(`$ORIGIN example.com.\n@ TXT "v=spf1 ip4:192.0.2.0/24 -all"`);
		expect((await check("::ffff:192.0.2.10")).result).toBe("pass");
	});

	test("uses postmaster for a sender without a local-part", async () => {
		serve(
			`$ORIGIN example.com.\n@ TXT "v=spf1 exists:%{l}.allow.%{d} -all"\npostmaster.allow A 127.0.0.2`,
		);
		let evaluation = await checkHost({
			ip: "203.0.113.1",
			domain: "example.com",
			sender: "example.com",
		});
		expect(evaluation.result).toBe("pass");
	});
});
