/**
 * Covers BIMI Assertion Records with the draft's own examples as fixtures (§4.3.1's
 * declinations, §4.5's `lps=` forms), discovery with the Organizational Domain fallback,
 * and the DMARC enforcement §7.1 requires.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { bimiDmarcShortfalls, discoverBimi, parseBimiRecord } from "./bimi.js";
import { discoverDmarc } from "./dmarc.js";
import { serveZone } from "./fixtures/dns.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("parseBimiRecord", () => {
	test("reads a logo and its evidence document", () => {
		let record = unwrap(
			parseBimiRecord("v=BIMI1; l=https://example.com/logo.svg; a=https://example.com/vmc.pem"),
		);
		expect(record).toMatchObject({
			location: "https://example.com/logo.svg",
			evidence: "https://example.com/vmc.pem",
			declined: false,
			localPartPrefixes: null,
			avatarPreference: "brand",
		});
	});

	test("reads §4.3.1's explicit declination", () => {
		expect(unwrap(parseBimiRecord("v=BIMI1; l=; a=;"))).toMatchObject({
			location: null,
			evidence: null,
			declined: true,
		});
	});

	test("reads §4.3.1's declination with local-part selectors", () => {
		let record = unwrap(parseBimiRecord("v=BIMI1; l=; a=; lps=brand-indicators-;"));
		expect(record.localPartPrefixes).toEqual(["brand-indicators-"]);
	});

	test.each([
		["lps=", []],
		["lps = brand-one-noreply , brand-two-noreply", ["brand-one-noreply", "brand-two-noreply"]],
	])("reads §4.5's %s", (lps, prefixes) => {
		let record = unwrap(parseBimiRecord(`v=BIMI1; l=https://example.com/l.svg; ${lps}`));
		expect(record.localPartPrefixes).toEqual(prefixes);
	});

	test("reads avp=personal and ignores an unknown avp", () => {
		expect(unwrap(parseBimiRecord("v=BIMI1; l=; avp=personal")).avatarPreference).toBe("personal");
		expect(unwrap(parseBimiRecord("v=BIMI1; l=; avp=other")).avatarPreference).toBe("brand");
	});

	test.each([
		["l=https://example.com/l.svg; v=BIMI1", "v=BIMI1"],
		["v=bimi1; l=", "v=BIMI1"],
		["v=BIMI1; a=", "no `l=`"],
		["v=BIMI1; l=http://example.com/l.svg", "HTTPS"],
		["v=BIMI1; l=https://192.0.2.1/l.svg", "HTTPS"],
		["v=BIMI1; l=https://example.com/a.svg,https://example.com/b.svg", "HTTPS"],
		["v=BIMI1; l=https://example.com/logo.png", "SVG"],
		["v=BIMI1; l=; a=ftp://example.com/vmc.pem", "`a=`"],
		["v=BIMI1; l=; lps=no_underscores", "`lps=`"],
		["v=BIMI1; l=; l=", "twice"],
	])("rejects %s", (text, message) => {
		let record = parseBimiRecord(text);
		expect(isFailure(record) && record.error.message).toContain(message);
	});
});

describe("discoverBimi", () => {
	test("finds the default selector at the Author Domain", async () => {
		serveZone(server, `default._bimi IN TXT "v=BIMI1; l=https://example.com/logo.svg"`);
		let found = unwrap(await discoverBimi("example.com", { organizationalDomain: "example.com" }));
		expect(found).toMatchObject({ status: "found", name: "default._bimi.example.com" });
	});

	test("falls back to the Organizational Domain", async () => {
		serveZone(
			server,
			`default._bimi IN TXT "v=BIMI1; l=https://example.com/logo.svg"
_dmarc IN TXT "v=DMARC1; p=reject"`,
		);
		let found = unwrap(await discoverBimi("news.example.com"));
		expect(found).toMatchObject({ status: "found", name: "default._bimi.example.com" });
	});

	test("reads a custom selector and ignores other TXT records at the name", async () => {
		serveZone(
			server,
			`brand._bimi IN TXT "v=BIMI1; l=https://example.com/b.svg"\nbrand._bimi IN TXT "x"`,
		);
		let found = unwrap(
			await discoverBimi("example.com", { selector: "brand", organizationalDomain: "example.com" }),
		);
		expect(found.status).toBe("found");
	});

	test("treats several records as none applying", async () => {
		serveZone(server, `default._bimi IN TXT "v=BIMI1; l="\ndefault._bimi IN TXT "v=BIMI1; a="`);
		let found = unwrap(await discoverBimi("example.com", { organizationalDomain: "example.com" }));
		expect(found).toMatchObject({ status: "multiple", count: 2 });
	});

	test("reports none when neither domain publishes one", async () => {
		serveZone(server, `@ IN A 192.0.2.1`);
		expect(
			unwrap(await discoverBimi("example.com", { organizationalDomain: "example.com" })).status,
		).toBe("none");
	});
});

describe("bimiDmarcShortfalls", () => {
	/** The shortfalls for `example.com` under the given DMARC records. */
	async function shortfalls(zone: string, domain = "example.com") {
		serveZone(server, zone);
		return bimiDmarcShortfalls(unwrap(await discoverDmarc(domain)));
	}

	test("accepts p=reject and p=quarantine", async () => {
		expect(await shortfalls(`_dmarc IN TXT "v=DMARC1; p=reject"`)).toEqual([]);
		expect(await shortfalls(`_dmarc IN TXT "v=DMARC1; p=quarantine; pct=100"`)).toEqual([]);
	});

	test.each([
		["", ["no-policy"]],
		[`_dmarc IN TXT "v=DMARC1; p=none"`, ["policy-none"]],
		[`_dmarc IN TXT "v=DMARC1; p=reject; sp=none"`, ["subdomain-policy-none"]],
		[`_dmarc IN TXT "v=DMARC1; p=quarantine; t=y"`, ["testing"]],
		[`_dmarc IN TXT "v=DMARC1; p=quarantine; pct=50"`, ["partial-pct"]],
	])("flags %j", async (zone, expected) => {
		expect(await shortfalls(zone || "@ IN A 192.0.2.1")).toEqual(expected);
	});

	test("holds a subdomain to its Organizational Domain's record too", async () => {
		let zone = `_dmarc IN TXT "v=DMARC1; p=none"\n_dmarc.news IN TXT "v=DMARC1; p=reject"`;
		expect(await shortfalls(zone, "news.example.com")).toEqual(["policy-none"]);
	});
});
