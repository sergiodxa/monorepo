/**
 * Tests for the `sdxc-email-auth` command line, driven through `invoke()` against zone
 * fixtures served over DNS-over-HTTPS and an MTA-STS policy host mocked with MSW: the human
 * report, `--json`, exit codes for passing, failing and malformed input.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { invoke } from "@sdxc/cli/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { cli } from "./cli.js";
import { serveZone } from "./fixtures/dns.js";

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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

/** Serves the healthy zone's MTA-STS policy file. */
function servePolicy() {
	server.use(
		http.get("https://mta-sts.example.com/.well-known/mta-sts.txt", () =>
			HttpResponse.text("version: STSv1\nmode: enforce\nmx: mail.example.com\nmax_age: 86400\n", {
				headers: { "content-type": "text/plain" },
			}),
		),
	);
}

describe("sdxc-email-auth check", () => {
	test("reports every policy passing and exits 0", async () => {
		serveZone(server, HEALTHY_ZONE);
		servePolicy();
		let run = await invoke(cli, ["check", "example.com", "-s", "google"]);
		expect(run.code).toBe(0);
		expect(run.stderr).toBe("");
		expect(run.stdout).toBe(
			[
				"example.com",
				"",
				"✓ DMARC        p=reject  _dmarc.example.com",
				"✓ SPF          1 of 10 DNS lookups  example.com",
				"✓ MTA-STS      mode enforce  _mta-sts.example.com",
				"✓ TLS-RPT      reports to mailto:tls@example.com  _smtp._tls.example.com",
				"✓ BIMI         https://example.com/logo.svg  default._bimi.example.com",
				"✓ DKIM google  rsa key  google._domainkey.example.com",
				"",
				"6 passed",
				"",
			].join("\n"),
		);
	});

	test("lists each problem under its policy and exits 1 when one fails", async () => {
		serveZone(server, `@ IN TXT "v=spf1 +all"\n_dmarc IN TXT "v=DMARC1; p=none"`);
		let run = await invoke(cli, ["check", "example.com", "--skip", "mta-sts,tls-rpt,bimi,dkim"]);
		expect(run.code).toBe(1);
		expect(run.stdout).toBe(
			[
				"example.com",
				"",
				"! DMARC  p=none  _dmarc.example.com",
				"    p=none only monitors; failing mail is still delivered",
				"    No rua= address, so no aggregate reports arrive",
				"✗ SPF    0 of 10 DNS lookups  example.com",
				"    example.com ends in +all, which authorizes every address",
				"",
				"1 failed, 1 warned",
				"",
			].join("\n"),
		);
	});

	test("notes on stderr that DKIM needs a selector", async () => {
		serveZone(server, HEALTHY_ZONE);
		let run = await invoke(cli, ["check", "example.com", "--skip", "dmarc,spf,mta-sts,bimi"]);
		expect(run.code).toBe(0);
		expect(run.stderr).toBe(
			"DKIM not checked: pass --selector <name> for each selector the domain signs with\n",
		);
	});

	test("prints the report as JSON with --json", async () => {
		serveZone(server, `@ IN A 192.0.2.1`);
		let run = await invoke(cli, [
			"check",
			"example.com",
			"--json",
			"--skip=dmarc,spf,mta-sts,bimi",
			"--selector=s1",
		]);
		expect(run.code).toBe(1);
		expect(JSON.parse(run.stdout)).toEqual({
			domain: "example.com",
			ok: false,
			results: [
				{
					policy: "tls-rpt",
					verdict: "fail",
					name: "_smtp._tls.example.com",
					summary: "no record",
					problems: ["No TLS-RPT record"],
				},
				{
					policy: "dkim",
					verdict: "fail",
					name: "s1._domainkey.example.com",
					summary: "no record",
					problems: ["No DKIM key"],
					selector: "s1",
				},
			],
		});
	});

	test("exits 1 when DNS cannot answer", async () => {
		serveZone(server, HEALTHY_ZONE, { failing: ["example.com"] });
		let run = await invoke(cli, [
			"check",
			"example.com",
			"--skip",
			"dmarc,mta-sts,tls-rpt,bimi,dkim",
		]);
		expect(run.code).toBe(1);
		expect(run.stdout).toContain("? SPF  DNS lookup failed  example.com");
		expect(run.stdout).toContain("1 unreadable");
	});

	test.each([
		[["check", "https://example.com"], "expects a domain name"],
		[["check", "example.com", "--skip", "dnssec"], "--skip"],
		[["check"], "domain"],
	])("exits 2 on %j", async (argv, message) => {
		let run = await invoke(cli, argv);
		expect(run.code).toBe(2);
		expect(run.stderr).toContain(message);
		expect(run.stdout).toBe("");
	});
});
