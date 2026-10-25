/**
 * Tests for the Certificate Transparency lookup: which logged certificate covers a host,
 * how Cert Spotter's pages, errors and rate limit are read, and that a host is searched
 * once per cache lifetime. Cert Spotter is intercepted with MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MemoryCache } from "@sdxc/cache/memory";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { LoggedCertificate } from "~/app/services/certificate-transparency";

import {
	CertificateTransparency,
	coversHost,
	pickCertificate,
} from "~/app/services/certificate-transparency";

const SEARCH_URL = "https://api.certspotter.com/v1/issuances";

const NOW = Date.parse("2026-10-24T12:00:00Z");

/** One issuance as Cert Spotter writes it. */
function issuance(
	id: string,
	names: string[],
	notBefore: string,
	notAfter: string,
	extra: { revoked?: boolean } = {},
) {
	return {
		id,
		tbs_sha256: `tbs-${id}`,
		cert_sha256: `cert-${id}`,
		dns_names: names,
		issuer: { friendly_name: "Let's Encrypt", name: "C=US, O=Let's Encrypt, CN=R11" },
		not_before: notBefore,
		not_after: notAfter,
		revoked: extra.revoked ?? false,
	};
}

/** Every search URL the tests' Cert Spotter received. */
let requests: URL[] = [];

let server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
	requests = [];
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Answers every search with `pages[n]` for the n-th request, linking to the next one. */
function certSpotter(pages: unknown[][]) {
	server.use(
		http.get(SEARCH_URL, ({ request }) => {
			let url = new URL(request.url);
			requests.push(url);
			let index = requests.length - 1;
			let headers = new Headers({ "content-type": "application/json" });
			if (index < pages.length - 1) {
				headers.set("link", `<${SEARCH_URL}?after=${index}>; rel="next"`);
			}
			return HttpResponse.json(pages[index] ?? [], { headers });
		}),
	);
}

/** A logged certificate for the pure helpers. */
function logged(names: string[], notBefore: string, notAfter: string): LoggedCertificate {
	return {
		sha256: null,
		names,
		issuer: null,
		notBefore: Date.parse(notBefore),
		notAfter: Date.parse(notAfter),
	};
}

describe("coversHost", () => {
	test("matches the same name, ignoring case and a trailing dot", () => {
		expect(coversHost("WWW.Example.com.", "www.example.com")).toBe(true);
	});

	test("lets a wildcard stand for exactly one leftmost label", () => {
		expect(coversHost("*.example.com", "www.example.com")).toBe(true);
		expect(coversHost("*.example.com", "example.com")).toBe(false);
		expect(coversHost("*.example.com", "a.b.example.com")).toBe(false);
		expect(coversHost("*.other.com", "www.example.com")).toBe(false);
	});
});

describe("pickCertificate", () => {
	test("prefers the covering certificate issued last", () => {
		let older = logged(["www.example.com"], "2026-08-01T00:00:00Z", "2026-11-01T00:00:00Z");
		let newer = logged(["*.example.com"], "2026-10-01T00:00:00Z", "2026-12-30T00:00:00Z");

		expect(pickCertificate("www.example.com", [older, newer], NOW)).toBe(newer);
	});

	test("skips certificates for other names, not yet valid, or already expired", () => {
		let otherName = logged(["api.example.com"], "2026-10-20T00:00:00Z", "2027-01-01T00:00:00Z");
		let future = logged(["www.example.com"], "2026-10-30T00:00:00Z", "2027-01-30T00:00:00Z");
		let expired = logged(["www.example.com"], "2026-07-01T00:00:00Z", "2026-10-01T00:00:00Z");

		expect(pickCertificate("www.example.com", [otherName, future, expired], NOW)).toBeNull();
	});
});

describe("CertificateTransparency.lookup", () => {
	test("finds the newest valid certificate across every page", async () => {
		certSpotter([
			[
				issuance(
					"1",
					["example.com", "www.example.com"],
					"2026-08-01T00:00:00Z",
					"2026-10-30T00:00:00Z",
				),
			],
			[issuance("2", ["*.example.com"], "2026-10-01T00:00:00Z", "2026-12-30T08:00:00Z")],
		]);

		let lookup = await new CertificateTransparency({ cache: new MemoryCache() }).lookup(
			"www.example.com",
			NOW,
		);

		expect(lookup).toEqual({
			status: "found",
			certificate: {
				sha256: "cert-2",
				names: ["*.example.com"],
				issuer: "Let's Encrypt",
				notBefore: Date.parse("2026-10-01T00:00:00Z"),
				notAfter: Date.parse("2026-12-30T08:00:00Z"),
			},
		});
		expect(requests[0]?.searchParams.get("domain")).toBe("www.example.com");
		expect(requests[0]?.searchParams.get("match_wildcards")).toBe("true");
		expect(requests[1]?.searchParams.get("after")).toBe("1");
	});

	test("passes over a revoked certificate", async () => {
		certSpotter([
			[
				issuance("1", ["www.example.com"], "2026-08-01T00:00:00Z", "2026-11-01T00:00:00Z"),
				issuance("2", ["www.example.com"], "2026-10-01T00:00:00Z", "2026-12-30T00:00:00Z", {
					revoked: true,
				}),
			],
		]);

		let lookup = await new CertificateTransparency({ cache: new MemoryCache() }).lookup(
			"www.example.com",
			NOW,
		);

		expect(lookup.status === "found" && lookup.certificate.sha256).toBe("cert-1");
	});

	test("answers not-found when the logs hold no certificate for the host", async () => {
		certSpotter([[]]);

		let lookup = await new CertificateTransparency({ cache: new MemoryCache() }).lookup(
			"www.example.com",
			NOW,
		);

		expect(lookup).toEqual({ status: "not-found" });
	});

	test("answers not-found for an address literal without asking", async () => {
		let client = new CertificateTransparency({ cache: new MemoryCache() });

		expect(await client.lookup("203.0.113.7", NOW)).toEqual({ status: "not-found" });
		expect(await client.lookup("[2001:db8::1]", NOW)).toEqual({ status: "not-found" });
		expect(requests).toEqual([]);
	});

	test("answers unavailable when Cert Spotter errors, and caches nothing", async () => {
		server.use(
			http.get(SEARCH_URL, ({ request }) => {
				requests.push(new URL(request.url));
				return new HttpResponse("Bad Gateway", { status: 502 });
			}),
		);
		let cache = new MemoryCache();

		let lookup = await new CertificateTransparency({ cache }).lookup("www.example.com", NOW);

		expect(lookup).toEqual({ status: "unavailable", reason: "Cert Spotter answered 502" });

		requests = [];
		certSpotter([
			[issuance("1", ["www.example.com"], "2026-10-01T00:00:00Z", "2026-12-30T00:00:00Z")],
		]);
		let retried = await new CertificateTransparency({ cache }).lookup("www.example.com", NOW);
		expect(retried.status).toBe("found");
	});

	test("answers unavailable for a body that is not the documented shape", async () => {
		server.use(http.get(SEARCH_URL, () => HttpResponse.json({ error: "nope" })));

		let lookup = await new CertificateTransparency({ cache: new MemoryCache() }).lookup(
			"www.example.com",
			NOW,
		);

		expect(lookup.status).toBe("unavailable");
	});

	test("stops asking for the rest of the run once rate limited", async () => {
		server.use(
			http.get(SEARCH_URL, ({ request }) => {
				requests.push(new URL(request.url));
				return new HttpResponse(null, { status: 429 });
			}),
		);
		let client = new CertificateTransparency({ cache: new MemoryCache() });

		let first = await client.lookup("a.example.com", NOW);
		let second = await client.lookup("b.example.com", NOW);

		expect(first).toEqual({ status: "unavailable", reason: "Cert Spotter rate limit reached" });
		expect(second).toEqual({ status: "unavailable", reason: "Cert Spotter rate limit reached" });
		expect(requests).toHaveLength(1);
	});

	test("searches a host once while its answer is cached", async () => {
		certSpotter([
			[issuance("1", ["www.example.com"], "2026-10-01T00:00:00Z", "2026-12-30T00:00:00Z")],
		]);
		let cache = new MemoryCache();

		await new CertificateTransparency({ cache }).lookup("www.example.com", NOW);
		let again = await new CertificateTransparency({ cache }).lookup("WWW.example.com.", NOW);

		expect(again.status).toBe("found");
		expect(requests).toHaveLength(1);
	});
});
