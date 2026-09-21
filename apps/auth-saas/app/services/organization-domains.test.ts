/**
 * Exercises `verifyOrganizationDomain`: it looks up the TXT record the tenant
 * object says a domain expects, over Cloudflare's DNS-over-HTTPS resolver
 * (stubbed with MSW), and calls `confirmOrganizationDomain` only on a real
 * match — never when the record is absent, wrong, or already verified.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type Tenant from "~/database/tenant-do";

import { verifyOrganizationDomain } from "./organization-domains";

let DNS_QUERY_URL = "https://cloudflare-dns.com/dns-query";

let server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Answers a DNS-over-HTTPS TXT query with the given already-quoted values. */
function respondWithTxt(values: string[]) {
	server.use(
		http.get(DNS_QUERY_URL, () => {
			return HttpResponse.json({
				Answer: values.map((value) => ({ type: 16, data: `"${value}"` })),
			});
		}),
	);
}

/** Answers a DNS-over-HTTPS query with no records at all — nothing published yet. */
function respondWithNothing() {
	server.use(http.get(DNS_QUERY_URL, () => HttpResponse.json({})));
}

/**
 * A stub answering `describeOrganizationDomain`/`confirmOrganizationDomain` from
 * fixed values, recording every `confirmOrganizationDomain` call so a test can
 * assert whether it ran.
 */
function stubTenant(described: {
	ok: boolean;
	domain?: string;
	mode?: "auto_join" | "suggest";
	verification?: { name: string; value: string };
	verifiedAt?: number | null;
	reason?: "not-found";
}) {
	let confirmCalls: Array<{ organizationId: string; domain: string }> = [];

	let stub = {
		describeOrganizationDomain: async () => described,
		confirmOrganizationDomain: async (input: { organizationId: string; domain: string }) => {
			confirmCalls.push(input);
			return { ok: true, verifiedAt: 1_700_000_000_000 };
		},
	} as unknown as DurableObjectStub<Tenant>;

	return { stub, confirmCalls };
}

describe("verifyOrganizationDomain", () => {
	test("confirms the domain when the published TXT value matches", async () => {
		respondWithTxt(["the-expected-value"]);
		let { stub, confirmCalls } = stubTenant({
			ok: true,
			domain: "acme.com",
			mode: "auto_join",
			verification: { name: "_sdxc-domain-verify.acme.com", value: "the-expected-value" },
			verifiedAt: null,
		});

		let result = await verifyOrganizationDomain(stub, {
			organizationId: "org_1",
			domain: "acme.com",
		});

		expect(result).toEqual({ outcome: "verified" });
		expect(confirmCalls).toEqual([{ organizationId: "org_1", domain: "acme.com" }]);
	});

	test("matches one of several published TXT values at the same name", async () => {
		respondWithTxt(["unrelated-record", "the-expected-value"]);
		let { stub, confirmCalls } = stubTenant({
			ok: true,
			domain: "acme.com",
			mode: "auto_join",
			verification: { name: "_sdxc-domain-verify.acme.com", value: "the-expected-value" },
			verifiedAt: null,
		});

		let result = await verifyOrganizationDomain(stub, {
			organizationId: "org_1",
			domain: "acme.com",
		});

		expect(result).toEqual({ outcome: "verified" });
		expect(confirmCalls).toHaveLength(1);
	});

	test("does nothing when the published value does not match", async () => {
		respondWithTxt(["some-other-value"]);
		let { stub, confirmCalls } = stubTenant({
			ok: true,
			domain: "acme.com",
			mode: "auto_join",
			verification: { name: "_sdxc-domain-verify.acme.com", value: "the-expected-value" },
			verifiedAt: null,
		});

		let result = await verifyOrganizationDomain(stub, {
			organizationId: "org_1",
			domain: "acme.com",
		});

		expect(result).toEqual({ outcome: "no-match" });
		expect(confirmCalls).toEqual([]);
	});

	test("does nothing when nothing is published yet", async () => {
		respondWithNothing();
		let { stub, confirmCalls } = stubTenant({
			ok: true,
			domain: "acme.com",
			mode: "auto_join",
			verification: { name: "_sdxc-domain-verify.acme.com", value: "the-expected-value" },
			verifiedAt: null,
		});

		let result = await verifyOrganizationDomain(stub, {
			organizationId: "org_1",
			domain: "acme.com",
		});

		expect(result).toEqual({ outcome: "no-match" });
		expect(confirmCalls).toEqual([]);
	});

	test("never queries DNS for a domain already verified", async () => {
		// No MSW handler registered — a lookup here would fail as unhandled.
		let { stub, confirmCalls } = stubTenant({
			ok: true,
			domain: "acme.com",
			mode: "auto_join",
			verification: { name: "_sdxc-domain-verify.acme.com", value: "the-expected-value" },
			verifiedAt: 1_699_000_000_000,
		});

		let result = await verifyOrganizationDomain(stub, {
			organizationId: "org_1",
			domain: "acme.com",
		});

		expect(result).toEqual({ outcome: "already-verified" });
		expect(confirmCalls).toEqual([]);
	});

	test("never queries DNS for a domain nobody claimed", async () => {
		// No MSW handler registered — a lookup here would fail as unhandled.
		let { stub, confirmCalls } = stubTenant({ ok: false, reason: "not-found" });

		let result = await verifyOrganizationDomain(stub, {
			organizationId: "org_1",
			domain: "never-claimed.com",
		});

		expect(result).toEqual({ outcome: "not-found" });
		expect(confirmCalls).toEqual([]);
	});
});
