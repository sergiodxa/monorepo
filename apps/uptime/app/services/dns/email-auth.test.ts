/**
 * Covers the email-authentication audit over a scripted DNS-over-HTTPS resolver and policy
 * host: each finding the task names, the receiving checks a mail-less domain skips, and a
 * resolver failure read as an unchecked protocol.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CLOUDFLARE } from "@sdxc/doh";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { checkEmailAuth } from "~/app/services/dns/email-auth";
import { EMAIL_AUTH_FINDING_CODES, emailAuthFindingMessage } from "~/app/services/dns/findings";
import en from "~/resources/locales/en";

/** The DoH JSON type codes of the record types the audit asks for. */
const TYPE_CODES: Record<string, number> = { MX: 15, TXT: 16 };

/** A domain that gets everything right. */
const HEALTHY: Zone = {
	"example.com": {
		MX: ["10 mx1.example.com."],
		TXT: ['"v=spf1 mx include:_spf.example.net -all"'],
	},
	"_dmarc.example.com": { TXT: ['"v=DMARC1; p=reject; rua=mailto:dmarc@example.com"'] },
	"_spf.example.net": { TXT: ['"v=spf1 ip4:192.0.2.0/24 -all"'] },
	"_mta-sts.example.com": { TXT: ['"v=STSv1; id=20260101"'] },
	"_smtp._tls.example.com": { TXT: ['"v=TLSRPTv1; rua=mailto:tls@example.com"'] },
};

/** The policy file the healthy domain serves. */
const POLICY = "version: STSv1\nmode: enforce\nmx: mx1.example.com\nmax_age: 604800\n";

/** Records per name and type; a name left out is NXDOMAIN. */
type Zone = Record<string, Record<string, string[]>>;

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Serves `zone` over DoH and `policy` as the MTA-STS policy file; `failing` names answer SERVFAIL. */
function serve(zone: Zone, policy: string | null = POLICY, failing: string[] = []) {
	server.use(
		http.get(CLOUDFLARE.url, ({ request }) => {
			let url = new URL(request.url);
			let name = url.searchParams.get("name") ?? "";
			let type = url.searchParams.get("type") ?? "";
			if (failing.includes(name)) return HttpResponse.json({ Status: 2 });
			let records = zone[name];
			if (!records) return HttpResponse.json({ Status: 3 });
			let code = TYPE_CODES[type] ?? 0;
			let Answer = (records[type] ?? []).map((data) => ({
				name: `${name}.`,
				type: code,
				TTL: 300,
				data,
			}));
			return HttpResponse.json({ Status: 0, Answer });
		}),
		http.get("https://mta-sts.example.com/.well-known/mta-sts.txt", () =>
			policy === null
				? HttpResponse.text("not found", { status: 404 })
				: HttpResponse.text(policy, { headers: { "content-type": "text/plain" } }),
		),
	);
}

/** The codes of the audit's findings, in order. */
async function codes(): Promise<string[]> {
	let check = await checkEmailAuth("Example.com.");
	return check.findings.map((finding) => finding.code);
}

describe("checkEmailAuth", () => {
	test("finds nothing on a domain that gets everything right", async () => {
		serve(HEALTHY);
		let check = await checkEmailAuth("example.com");
		expect(check).toEqual({ domain: "example.com", receivesMail: true, findings: [] });
	});

	test("reports a missing DMARC policy as critical", async () => {
		let { "_dmarc.example.com": _, ...zone } = HEALTHY;
		serve(zone);
		let check = await checkEmailAuth("example.com");
		expect(check.findings).toEqual([
			{ code: "dmarc-missing", severity: "critical", values: { domain: "_dmarc.example.com" } },
		]);
	});

	test("reports p=none and a missing rua", async () => {
		serve({ ...HEALTHY, "_dmarc.example.com": { TXT: ['"v=DMARC1; p=none"'] } });
		expect(await codes()).toEqual(["dmarc-policy-none", "dmarc-no-reports"]);
	});

	test("reports the testing flag on an enforcing policy", async () => {
		serve({
			...HEALTHY,
			"_dmarc.example.com": { TXT: ['"v=DMARC1; p=reject; t=y; rua=mailto:d@example.com"'] },
		});
		expect(await codes()).toEqual(["dmarc-testing"]);
	});

	test("reports SPF over ten lookups with the count", async () => {
		let includes = Array.from({ length: 11 }, (_, index) => `include:s${index}.example.net`).join(
			" ",
		);
		serve({
			...HEALTHY,
			"example.com": { ...HEALTHY["example.com"], TXT: [`"v=spf1 ${includes} -all"`] },
		});
		let check = await checkEmailAuth("example.com");
		expect(check.findings[0]).toEqual({
			code: "spf-too-many-lookups",
			severity: "critical",
			values: { domain: "example.com", count: 11 },
		});
	});

	test("reports several SPF records", async () => {
		serve({
			...HEALTHY,
			"example.com": { ...HEALTHY["example.com"], TXT: ['"v=spf1 -all"', '"v=spf1 mx -all"'] },
		});
		expect(await codes()).toEqual(["spf-multiple"]);
	});

	test("reports MTA-STS in testing mode", async () => {
		serve(HEALTHY, POLICY.replace("enforce", "testing"));
		expect(await codes()).toEqual(["mta-sts-testing"]);
	});

	test("reports an unreachable policy file", async () => {
		serve(HEALTHY, null);
		expect(await codes()).toEqual(["mta-sts-policy-unreachable"]);
	});

	test("reports an MX host an enforcing policy leaves out", async () => {
		serve({
			...HEALTHY,
			"example.com": {
				...HEALTHY["example.com"],
				MX: ["10 mx1.example.com.", "20 backup.example.org."],
			},
		});
		let check = await checkEmailAuth("example.com");
		expect(check.findings).toEqual([
			{
				code: "mta-sts-mx-mismatch",
				severity: "critical",
				values: { domain: "example.com", host: "backup.example.org" },
			},
		]);
	});

	test("reports a missing TLS-RPT record", async () => {
		let { "_smtp._tls.example.com": _, ...zone } = HEALTHY;
		serve(zone);
		expect(await codes()).toEqual(["tls-rpt-missing"]);
	});

	test("skips MTA-STS and TLS-RPT for a domain with a null MX", async () => {
		serve({
			...HEALTHY,
			"example.com": { ...HEALTHY["example.com"], MX: ["0 ."] },
			"_mta-sts.example.com": {},
		});
		let check = await checkEmailAuth("example.com");
		expect(check).toMatchObject({ receivesMail: false, findings: [] });
	});

	test("reads a resolver failure as an unchecked protocol, never a missing record", async () => {
		serve(HEALTHY, POLICY, ["_dmarc.example.com"]);
		let check = await checkEmailAuth("example.com");
		expect(check.findings).toEqual([
			{ code: "lookup-failed", severity: "warning", values: { record: "DMARC" } },
		]);
	});

	test("orders findings most severe first", async () => {
		serve({
			...HEALTHY,
			"example.com": { MX: ["10 mx1.example.com."] },
			"_dmarc.example.com": { TXT: ['"v=DMARC1; p=none"'] },
			"_smtp._tls.example.com": {},
		});
		expect(await codes()).toEqual([
			"spf-missing",
			"dmarc-policy-none",
			"dmarc-no-reports",
			"tls-rpt-missing",
		]);
	});
});

describe("emailAuthFindingMessage", () => {
	let messages = en.page.dnsMonitorDetail.emailAuth.findings as Record<string, string>;

	test.each(EMAIL_AUTH_FINDING_CODES)("names an English message for %s", (code) => {
		let { key } = emailAuthFindingMessage({ code, severity: "notice", values: {} });
		expect(messages[key.split(".").at(-1) ?? ""]).toBeTypeOf("string");
	});

	test("interpolates the values the audit passes", () => {
		let { key, values } = emailAuthFindingMessage({
			code: "spf-too-many-lookups",
			severity: "critical",
			values: { domain: "example.com", count: 13 },
		});
		expect(key).toBe("page.dnsMonitorDetail.emailAuth.findings.spfTooManyLookups");
		expect(
			Object.keys(values)
				.map((name) => `{$${name}}`)
				.every((slot) => messages["spfTooManyLookups"]?.includes(slot)),
		).toBe(true);
	});
});
