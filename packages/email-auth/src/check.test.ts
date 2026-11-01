/**
 * Covers the whole-domain audit against zone fixtures served over DNS-over-HTTPS and an
 * MTA-STS policy host mocked with MSW: a domain that passes everything, then each way a
 * policy goes missing, weakens or cannot be read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { checkEmailAuth } from "./check.js";
import { serveZone } from "./fixtures/dns.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const POLICY_URL = "https://mta-sts.example.com/.well-known/mta-sts.txt";

/** A domain that publishes every policy in its strongest form. */
const HEALTHY_ZONE = [
	`@ IN MX 10 mail.example.com.`,
	`@ IN TXT "v=spf1 mx -all"`,
	`_dmarc IN TXT "v=DMARC1; p=reject; rua=mailto:dmarc@example.com"`,
	`_mta-sts IN TXT "v=STSv1; id=20261031"`,
	`_smtp._tls IN TXT "v=TLSRPTv1; rua=mailto:tls@example.com"`,
	`default._bimi IN TXT "v=BIMI1; l=https://example.com/logo.svg; a=https://example.com/vmc.pem"`,
	`google._domainkey IN TXT "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQ"`,
].join("\n");

/** Serves an MTA-STS policy file in `mode` listing `mx`. */
function servePolicy(mode: string, mx = "mail.example.com") {
	server.use(
		http.get(POLICY_URL, () =>
			HttpResponse.text(`version: STSv1\nmode: ${mode}\nmx: ${mx}\nmax_age: 86400\n`, {
				headers: { "content-type": "text/plain" },
			}),
		),
	);
}

/** Replaces the zone line starting with `prefix`, or drops it when `line` is empty. */
function zoneWith(prefix: string, line: string): string {
	return HEALTHY_ZONE.split("\n")
		.map((entry) => (entry.startsWith(prefix) ? line : entry))
		.filter((entry) => entry !== "")
		.join("\n");
}

describe("checkEmailAuth", () => {
	test("passes a domain that publishes every policy", async () => {
		serveZone(server, HEALTHY_ZONE);
		servePolicy("enforce");
		let report = await checkEmailAuth("Example.com.", { dkimSelectors: ["google"] });
		expect(report.domain).toBe("example.com");
		expect(report.ok).toBe(true);
		expect(report.results.map((result) => [result.policy, result.verdict])).toEqual([
			["dmarc", "pass"],
			["spf", "pass"],
			["mta-sts", "pass"],
			["tls-rpt", "pass"],
			["bimi", "pass"],
			["dkim", "pass"],
		]);
		expect(report.results[1]).toMatchObject({
			name: "example.com",
			summary: "1 of 10 DNS lookups",
		});
		expect(report.results[5]).toMatchObject({
			name: "google._domainkey.example.com",
			selector: "google",
		});
	});

	test("fails every missing policy", async () => {
		serveZone(server, `@ IN A 192.0.2.1`);
		let report = await checkEmailAuth("example.com", { dkimSelectors: ["s1"] });
		expect(report.ok).toBe(false);
		expect(report.results.every((result) => result.verdict === "fail")).toBe(true);
		expect(report.results.map((result) => result.summary)).toEqual([
			"no policy",
			"no record",
			"no record",
			"no record",
			"no record",
			"no record",
		]);
	});

	test("warns on a monitoring-only DMARC policy, and fails BIMI because of it", async () => {
		serveZone(server, zoneWith("_dmarc", `_dmarc IN TXT "v=DMARC1; p=none"`));
		servePolicy("enforce");
		let report = await checkEmailAuth("example.com", { skip: ["spf", "mta-sts", "tls-rpt"] });
		expect(report.results).toEqual([
			{
				policy: "dmarc",
				verdict: "warn",
				name: "_dmarc.example.com",
				summary: "p=none",
				problems: [
					"p=none only monitors; failing mail is still delivered",
					"No rua= address, so no aggregate reports arrive",
				],
			},
			{
				policy: "bimi",
				verdict: "fail",
				name: "default._bimi.example.com",
				summary: "https://example.com/logo.svg",
				problems: ["DMARC p=none, and BIMI needs quarantine or reject"],
				selector: "default",
			},
		]);
	});

	test("fails an SPF policy a receiver reads as permerror", async () => {
		serveZone(server, zoneWith("@ IN TXT", `@ IN TXT "v=spf1 include:gone.example.com ptr -all"`));
		let report = await checkEmailAuth("example.com", {
			skip: ["dmarc", "mta-sts", "tls-rpt", "bimi"],
		});
		expect(report.results[0]).toMatchObject({
			verdict: "fail",
			problems: [
				"gone.example.com publishes no SPF record",
				"example.com uses ptr, which RFC 7208 asks publishers to avoid",
			],
		});
	});

	test("fails an enforced MTA-STS policy that leaves an MX host out", async () => {
		serveZone(server, HEALTHY_ZONE);
		servePolicy("enforce", "other.example.com");
		let report = await checkEmailAuth("example.com", { skip: ["dmarc", "spf", "tls-rpt", "bimi"] });
		expect(report.results[0]).toMatchObject({
			verdict: "fail",
			summary: "mode enforce",
			problems: ["MX mail.example.com is not listed in the policy's mx:"],
		});
	});

	test("warns on an MTA-STS policy in testing", async () => {
		serveZone(server, HEALTHY_ZONE);
		servePolicy("testing");
		let report = await checkEmailAuth("example.com", { skip: ["dmarc", "spf", "tls-rpt", "bimi"] });
		expect(report.results[0]).toMatchObject({ verdict: "warn", summary: "mode testing" });
		expect(report.ok).toBe(true);
	});

	test("fails an MTA-STS record whose policy file is not served", async () => {
		serveZone(server, HEALTHY_ZONE);
		server.use(http.get(POLICY_URL, () => HttpResponse.text("missing", { status: 404 })));
		let report = await checkEmailAuth("example.com", { skip: ["dmarc", "spf", "tls-rpt", "bimi"] });
		expect(report.results[0]).toMatchObject({
			verdict: "fail",
			summary: "policy file unusable",
			problems: ["The policy host answered HTTP 404"],
		});
	});

	test("passes a declined BIMI record and fails a revoked DKIM key", async () => {
		serveZone(
			server,
			zoneWith("default._bimi", `default._bimi IN TXT "v=BIMI1; l=; a=;"`).replace(
				/p=MIG\w+/,
				"p=",
			),
		);
		let report = await checkEmailAuth("example.com", {
			skip: ["dmarc", "spf", "mta-sts", "tls-rpt"],
			dkimSelectors: ["google"],
		});
		expect(report.results.map((result) => [result.policy, result.verdict, result.summary])).toEqual(
			[
				["bimi", "pass", "declined"],
				["dkim", "fail", "revoked"],
			],
		);
	});

	test("reads a resolver failure as an error for the policies it left unknown", async () => {
		serveZone(server, HEALTHY_ZONE, { failing: ["_smtp._tls.example.com"] });
		let report = await checkEmailAuth("example.com", { skip: ["dmarc", "spf", "mta-sts", "bimi"] });
		expect(report.ok).toBe(false);
		expect(report.results[0]).toMatchObject({ verdict: "error", summary: "DNS lookup failed" });
	});

	test("queries nothing for skipped policies", async () => {
		let queries = serveZone(server, HEALTHY_ZONE);
		let report = await checkEmailAuth("example.com", {
			skip: ["dmarc", "spf", "mta-sts", "tls-rpt", "bimi"],
		});
		expect(report).toEqual({ domain: "example.com", ok: true, results: [] });
		expect(queries).toEqual([]);
	});
});
