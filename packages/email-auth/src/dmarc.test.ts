/**
 * Covers RFC 9989 DMARC with the RFC's own examples as fixtures: Appendix B.2's records,
 * §4.10's eight-query walk, §4.10.2's Organizational Domain examples and Appendix B.4's
 * Tree Walk scenarios served as DNS zones.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { isFailure, unwrap } from "@sdxc/result";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { DMARC } from "./dmarc.js";

import {
	appliedDmarcPolicy,
	discoverDmarc,
	dmarcTreeWalk,
	findOrganizationalDomain,
	isAligned,
	parseDmarcRecord,
	selectOrganizationalDomain,
} from "./dmarc.js";
import { serveZone } from "./fixtures/dns.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Parses a record the test knows is valid. */
function record(text: string): DMARC.Record {
	return unwrap(parseDmarcRecord(text));
}

describe("parseDmarcRecord", () => {
	test("reads Appendix B.2.1's monitoring-mode record", () => {
		expect(record("v=DMARC1; p=none; rua=mailto:dmarc-feedback@example.com")).toMatchObject({
			policy: "none",
			rua: ["mailto:dmarc-feedback@example.com"],
			ruf: [],
			testing: false,
			psd: "u",
			dkimAlignment: "relaxed",
			spfAlignment: "relaxed",
			failureOptions: ["0"],
			issues: [],
		});
	});

	test("reads Appendix B.2.3's third-party failure reports", () => {
		let parsed = record(
			"v=DMARC1; p=none; rua=mailto:dmarc-feedback@example.com; ruf=mailto:auth-reports@thirdparty.example.net",
		);
		expect(parsed.ruf).toEqual(["mailto:auth-reports@thirdparty.example.net"]);
	});

	test("reads Appendix B.2.5's testing record with two report URIs", () => {
		let parsed = record(
			"v=DMARC1; p=quarantine; rua=mailto:dmarc-feedback@example.com,mailto:tld-test@thirdparty.example.net; t=y",
		);
		expect(parsed).toMatchObject({
			policy: "quarantine",
			testing: true,
			rua: ["mailto:dmarc-feedback@example.com", "mailto:tld-test@thirdparty.example.net"],
		});
	});

	test("reads Appendix B.2.3's report authorization record, which has no p", () => {
		let parsed = record("v=DMARC1;");
		expect(parsed.policy).toBeNull();
		expect(appliedDmarcPolicy(parsed)).toBeNull();
	});

	test("reads np, sp, psd, strict alignment and failure options", () => {
		let parsed = record(
			"v=DMARC1; p=reject; sp=quarantine; np=reject; psd=n; adkim=s; aspf=s; fo=1:d:s",
		);
		expect(parsed).toMatchObject({
			subdomainPolicy: "quarantine",
			nonExistentPolicy: "reject",
			psd: "n",
			dkimAlignment: "strict",
			spfAlignment: "strict",
			failureOptions: ["1", "d", "s"],
		});
	});

	test("strips the obsolete size suffix from a report URI", () => {
		expect(record("v=DMARC1; p=none; rua=mailto:a@example.com!10m").rua).toEqual([
			"mailto:a@example.com",
		]);
	});

	test("discards invalid values in favor of defaults and lists them", () => {
		let parsed = record("v=DMARC1; p=block; adkim=x; fo=0:1; rua=nope");
		expect(parsed.policy).toBeNull();
		expect(parsed.dkimAlignment).toBe("relaxed");
		expect(parsed.failureOptions).toEqual(["0"]);
		expect(parsed.issues.map((issue) => issue.tag)).toEqual(["p", "adkim", "fo", "rua"]);
	});

	test("keeps tags RFC 9989 removed, such as pct, as unknown tags", () => {
		let parsed = record("v=DMARC1; p=reject; pct=50; ri=86400");
		expect(parsed.tags["pct"]).toBe("50");
		expect(parsed.policy).toBe("reject");
	});

	test.each(["p=none; v=DMARC1", "v=dmarc1; p=none", "v=DMARC2; p=none", ""])(
		"ignores %j entirely",
		(text) => {
			expect(isFailure(parseDmarcRecord(text))).toBe(true);
		},
	);
});

describe("appliedDmarcPolicy", () => {
	let parsed = record("v=DMARC1; p=reject; sp=quarantine; np=none");

	test("applies p to the domain, sp to subdomains and np to missing ones", () => {
		expect(appliedDmarcPolicy(parsed, "domain")).toBe("reject");
		expect(appliedDmarcPolicy(parsed, "subdomain")).toBe("quarantine");
		expect(appliedDmarcPolicy(parsed, "non-existent-subdomain")).toBe("none");
	});

	test("falls np back to sp, and sp back to p", () => {
		expect(
			appliedDmarcPolicy(record("v=DMARC1; p=reject; sp=none"), "non-existent-subdomain"),
		).toBe("none");
		expect(appliedDmarcPolicy(record("v=DMARC1; p=reject"), "subdomain")).toBe("reject");
	});

	test("reads a record without a valid p as none when it asks for reports", () => {
		expect(appliedDmarcPolicy(record("v=DMARC1; rua=mailto:a@example.com"))).toBe("none");
		expect(appliedDmarcPolicy(record("v=DMARC1; p=reject; sp=bad; rua=mailto:a@example.com"))).toBe(
			"none",
		);
	});
});

describe("dmarcTreeWalk", () => {
	test("makes §4.10's eight queries for a thirteen-label name", () => {
		expect(dmarcTreeWalk("a.b.c.d.e.f.g.h.i.j.mail.example.com")).toEqual([
			"a.b.c.d.e.f.g.h.i.j.mail.example.com",
			"g.h.i.j.mail.example.com",
			"h.i.j.mail.example.com",
			"i.j.mail.example.com",
			"j.mail.example.com",
			"mail.example.com",
			"example.com",
			"com",
		]);
	});

	test("walks one label at a time below eight labels", () => {
		expect(dmarcTreeWalk("A.mail.example.com.")).toEqual([
			"a.mail.example.com",
			"mail.example.com",
			"example.com",
			"com",
		]);
	});

	test("starts an eight-label name's walk at its parent", () => {
		expect(dmarcTreeWalk("a.b.c.d.e.f.example.com")).toHaveLength(8);
	});
});

describe("selectOrganizationalDomain", () => {
	let found = (domain: string, text = "v=DMARC1; p=none"): DMARC.Found => ({
		domain,
		record: record(text),
	});

	test("picks the record with the fewest labels (§4.10.2, first example)", () => {
		let walk = [found("mail.example.com"), found("example.com")];
		expect(selectOrganizationalDomain("a.mail.example.com", walk)).toBe("example.com");
	});

	test("stops at psd=n (§4.10.2, second example)", () => {
		let walk = [found("mail.example.com", "v=DMARC1; p=none; psd=n")];
		expect(selectOrganizationalDomain("a.mail.example.com", walk)).toBe("mail.example.com");
	});

	test("takes the domain below psd=y (§4.10.2, last example)", () => {
		let walk = [found("com", "v=DMARC1; p=none; psd=y")];
		expect(selectOrganizationalDomain("a.mail.example.com", walk)).toBe("example.com");
	});

	test("is the start itself when the walk found nothing", () => {
		expect(selectOrganizationalDomain("example.com", [])).toBe("example.com");
	});
});

/** Appendix B.4.1 and B.4.2's DNS: records at example.com and signing.example.com, none at com. */
const B4_ZONE = `
_dmarc IN TXT "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"
_dmarc.signing IN TXT "v=DMARC1; p=none"
$ORIGIN com.
@ IN NS a.gtld-servers.net.
`;

/** Appendix B.4.3's DNS: a PSD record at bank.example and an Organizational record at giant.bank.example. */
const B43_ZONE = `
$ORIGIN example.
@ IN NS ns.example.
$ORIGIN bank.example.
_dmarc IN TXT "v=DMARC1; p=reject; psd=y"
$ORIGIN giant.bank.example.
_dmarc IN TXT "v=DMARC1; p=quarantine"
$ORIGIN mega.bank.example.
mail IN A 192.0.2.1
`;

describe("discoverDmarc", () => {
	test("applies the Author Domain's own record (Appendix B.4.1)", async () => {
		serveZone(server, B4_ZONE);
		let discovery = unwrap(await discoverDmarc("example.com"));
		expect(discovery).toMatchObject({
			organizationalDomain: "example.com",
			policyDomain: "example.com",
			source: "author-domain",
			policy: "reject",
		});
		expect(discovery.lookups.map((entry) => entry.domain)).toEqual(["example.com", "com"]);
	});

	test("walks a deep Author Domain to its Organizational Domain (Appendix B.4.2)", async () => {
		let queries = serveZone(server, B4_ZONE);
		let discovery = unwrap(await discoverDmarc("a.b.c.d.e.f.g.h.i.j.k.example.com"));
		expect(discovery).toMatchObject({
			organizationalDomain: "example.com",
			policyDomain: "example.com",
			source: "organizational-domain",
			policy: "reject",
		});
		expect(queries).toEqual([
			"_dmarc.a.b.c.d.e.f.g.h.i.j.k.example.com/TXT",
			"_dmarc.g.h.i.j.k.example.com/TXT",
			"_dmarc.h.i.j.k.example.com/TXT",
			"_dmarc.i.j.k.example.com/TXT",
			"_dmarc.j.k.example.com/TXT",
			"_dmarc.k.example.com/TXT",
			"_dmarc.example.com/TXT",
			"_dmarc.com/TXT",
		]);
	});

	test("applies sp to a subdomain that inherits the Organizational record", async () => {
		serveZone(server, `_dmarc IN TXT "v=DMARC1; p=reject; sp=quarantine"`);
		expect(unwrap(await discoverDmarc("news.example.com")).policy).toBe("quarantine");
	});

	test("stops at psd=y and uses the domain below it (Appendix B.4.3)", async () => {
		serveZone(server, B43_ZONE);
		let discovery = unwrap(await discoverDmarc("giant.bank.example"));
		expect(discovery).toMatchObject({
			organizationalDomain: "giant.bank.example",
			policyDomain: "giant.bank.example",
			policy: "quarantine",
		});
		expect(discovery.lookups.map((entry) => entry.domain)).toEqual([
			"giant.bank.example",
			"bank.example",
		]);
	});

	test("falls back to the PSD record for an organization without one", async () => {
		serveZone(server, B43_ZONE);
		let discovery = unwrap(await discoverDmarc("mail.mega.bank.example"));
		expect(discovery).toMatchObject({
			organizationalDomain: "mega.bank.example",
			policyDomain: "bank.example",
			source: "public-suffix-domain",
			policy: "reject",
		});
	});

	test("finds no policy where nothing is published", async () => {
		serveZone(server, `@ IN A 192.0.2.1`);
		let discovery = unwrap(await discoverDmarc("example.com"));
		expect(discovery).toMatchObject({ record: null, policy: null, source: null });
	});

	test("discards several records at one name", async () => {
		serveZone(server, `_dmarc IN TXT "v=DMARC1; p=none"\n_dmarc IN TXT "v=DMARC1; p=reject"`);
		let discovery = unwrap(await discoverDmarc("example.com"));
		expect(discovery.record).toBeNull();
		expect(discovery.lookups[0]).toEqual({ domain: "example.com", found: "multiple" });
	});

	test("returns a resolver failure instead of reading it as no policy", async () => {
		serveZone(server, B4_ZONE, { failing: ["_dmarc.example.com"] });
		expect(isFailure(await discoverDmarc("example.com"))).toBe(true);
	});
});

describe("alignment", () => {
	test("aligns example.com with signing.example.com under relaxed mode (Appendix B.4.1)", async () => {
		serveZone(server, B4_ZONE);
		expect(unwrap(await findOrganizationalDomain("signing.example.com"))).toBe("example.com");
		expect(unwrap(await isAligned("example.com", "signing.example.com", "relaxed"))).toBe(true);
	});

	test("does not align them under strict mode", async () => {
		expect(unwrap(await isAligned("example.com", "signing.example.com", "strict"))).toBe(false);
	});

	test("does not align two organizations below a PSD (Appendix B.4.3)", async () => {
		serveZone(server, B43_ZONE);
		expect(
			unwrap(await isAligned("giant.bank.example", "mail.giant.bank.example", "relaxed")),
		).toBe(true);
		expect(unwrap(await isAligned("giant.bank.example", "mail.mega.bank.example", "relaxed"))).toBe(
			false,
		);
	});
});
