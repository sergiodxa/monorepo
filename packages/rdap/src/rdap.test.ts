/**
 * Exercises `RDAP` against MSW-mocked IANA and registry servers: the domain model built
 * from each registry shape, the bootstrap match and its cached and stale copies, the
 * `related` registrar query, and every `RDAPError` code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Result } from "@sdxc/result";
import type { JsonBodyType } from "msw";

import { MemoryCache } from "@sdxc/cache/memory";
import { isSuccess } from "@sdxc/result";
import { delay, http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { RDAPError } from "./error.js";

import {
	BOOTSTRAP,
	IDN_COM,
	NO_EXPIRY_CH,
	REGISTRAR_COM,
	THICK_ORG,
	THIN_COM,
} from "./fixtures/registries.js";
import { RDAP } from "./rdap.js";

const IANA = "https://data.iana.org/rdap/dns.json";
const VERISIGN = "https://rdap.verisign.com/com/v1/domain";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Serves the trimmed bootstrap file, counting how many times IANA was asked. */
function ianaServes(): { hits: number } {
	let counter = { hits: 0 };
	server.use(
		http.get(IANA, () => {
			counter.hits++;
			return HttpResponse.json(BOOTSTRAP);
		}),
	);
	return counter;
}

/** Answers `body` as RDAP JSON at `url`. */
function registry(url: string, body: JsonBodyType) {
	return http.get(url, () =>
		HttpResponse.json(body, { headers: { "content-type": "application/rdap+json" } }),
	);
}

/** A client over a fresh memory cache, with any option overridden. */
function client(options: Partial<RDAP.Options> = {}): RDAP {
	return new RDAP({ cache: new MemoryCache(), userAgent: "TestMonitor/1.0", ...options });
}

/**
 * The error of a lookup that must have failed.
 *
 * @template T - What the lookup answers on success.
 */
function errorOf<T>(result: Result<T, RDAPError>): RDAPError {
	if (isSuccess(result)) throw new Error("expected a failure");
	return result.error;
}

describe("RDAP.domain", () => {
	test("reads a thin registry's answer into the model", async () => {
		ianaServes();
		server.use(registry(`${VERISIGN}/acme-widgets.com`, THIN_COM));

		let result = await client().domain("acme-widgets.com");

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;
		expect(result.data).toEqual({
			name: "acme-widgets.com",
			unicodeName: null,
			handle: "2336799_DOMAIN_COM-VRSN",
			expiresAt: Date.parse("2028-09-14T04:00:00Z"),
			registeredAt: Date.parse("1997-09-15T04:00:00Z"),
			updatedAt: Date.parse("2019-09-09T15:39:04Z"),
			status: ["clientDeleteProhibited", "clientTransferProhibited", "clientUpdateProhibited"],
			registrar: { name: "Example Registrar, LLC", ianaId: "9999", abuseEmail: null },
			nameservers: ["ns1.exampledns.com", "ns2.exampledns.com"],
			dnssec: false,
			relatedUrl: "https://rdap.exampleregistrar.com/domain/ACME-WIDGETS.COM",
			server: `${VERISIGN}/acme-widgets.com`,
			document: THIN_COM,
		});
	});

	test("reads a thick registry's registrar, abuse email, DNSSEC and latest dates", async () => {
		ianaServes();
		server.use(
			registry("https://rdap.publicinterestregistry.org/rdap/domain/acme-widgets.org", THICK_ORG),
		);

		let result = await client().domain("acme-widgets.org");

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;
		expect(result.data.registrar).toEqual({
			name: "Org Registrar Inc.",
			ianaId: "1234",
			abuseEmail: "abuse@orgregistrar.com",
		});
		expect(result.data.status).toEqual([
			"clientTransferProhibited",
			"serverHold",
			"renew prohibited",
		]);
		expect(result.data.dnssec).toBe(true);
		expect(result.data.expiresAt).toBe(Date.parse("2027-03-11T10:20:30.000Z"));
		expect(result.data.updatedAt).toBeNull();
	});

	test("answers a null expiry and registrar when the registry publishes neither", async () => {
		ianaServes();
		server.use(registry("https://rdap.nic.ch/domain/acme-widgets.ch", NO_EXPIRY_CH));

		let result = await client().domain("acme-widgets.ch");

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;
		expect(result.data.expiresAt).toBeNull();
		expect(result.data.registeredAt).toBe(Date.parse("2005-07-01T00:00:00+02:00"));
		expect(result.data.registrar).toBeNull();
		expect(result.data.dnssec).toBeNull();
		expect(result.data.status).toEqual(["active"]);
	});

	test("queries an internationalized name in its A-label form", async () => {
		ianaServes();
		server.use(registry(`${VERISIGN}/xn--bcher-kva.com`, IDN_COM));

		let result = await client().domain("  Bücher.COM. ");

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;
		expect(result.data.name).toBe("xn--bcher-kva.com");
		expect(result.data.unicodeName).toBe("bücher.com");
		expect(result.data.status).toEqual(["active", "registrar experimental hold"]);
	});

	test("sends the RDAP media type and the configured user agent", async () => {
		ianaServes();
		let seen: Headers | undefined;
		server.use(
			http.get(`${VERISIGN}/acme-widgets.com`, ({ request }) => {
				seen = request.headers;
				return HttpResponse.json(THIN_COM);
			}),
		);

		await client().domain("acme-widgets.com");

		expect(seen?.get("accept")).toBe("application/rdap+json, application/json");
		expect(seen?.get("user-agent")).toBe("TestMonitor/1.0");
	});

	test("follows a redirect to the authoritative server and reports where it ended", async () => {
		ianaServes();
		server.use(
			http.get(`${VERISIGN}/acme-widgets.com`, () =>
				HttpResponse.redirect("https://rdap.mirror-registry.com/domain/acme-widgets.com", 301),
			),
			registry("https://rdap.mirror-registry.com/domain/acme-widgets.com", THIN_COM),
		);

		let result = await client().domain("acme-widgets.com");

		expect(isSuccess(result) && result.data.server).toBe(
			"https://rdap.mirror-registry.com/domain/acme-widgets.com",
		);
	});
});

describe("RDAP.domain with related: true", () => {
	test("fills the registrar fields the registry left empty and keeps the registry's expiry", async () => {
		ianaServes();
		server.use(
			registry(`${VERISIGN}/acme-widgets.com`, THIN_COM),
			registry("https://rdap.exampleregistrar.com/domain/ACME-WIDGETS.COM", REGISTRAR_COM),
		);

		let result = await client().domain("acme-widgets.com", { related: true });

		expect(isSuccess(result)).toBe(true);
		if (!isSuccess(result)) return;
		expect(result.data.registrar).toEqual({
			name: "Example Registrar, LLC",
			ianaId: "9999",
			abuseEmail: "abuse@exampleregistrar.com",
		});
		expect(result.data.expiresAt).toBe(Date.parse("2028-09-14T04:00:00Z"));
		expect(result.data.server).toBe(`${VERISIGN}/acme-widgets.com`);
	});

	test("keeps the registry's answer when the registrar's server fails", async () => {
		ianaServes();
		server.use(
			registry(`${VERISIGN}/acme-widgets.com`, THIN_COM),
			http.get(
				"https://rdap.exampleregistrar.com/domain/ACME-WIDGETS.COM",
				() => new HttpResponse(null, { status: 503 }),
			),
		);

		let result = await client().domain("acme-widgets.com", { related: true });

		expect(isSuccess(result) && result.data.registrar?.abuseEmail).toBeNull();
	});

	test("makes no second request when the registry answered a complete registrar", async () => {
		ianaServes();
		server.use(
			registry("https://rdap.publicinterestregistry.org/rdap/domain/acme-widgets.org", THICK_ORG),
		);

		let result = await client().domain("acme-widgets.org", { related: true });

		expect(isSuccess(result)).toBe(true);
	});
});

describe("RDAP.server", () => {
	test("matches the TLD case-insensitively and appends a missing trailing slash", async () => {
		ianaServes();
		let rdap = client();

		let ch = await rdap.server("acme-widgets.ch");
		let org = await rdap.server("acme-widgets.org");

		expect(isSuccess(ch) && ch.data?.href).toBe("https://rdap.nic.ch/");
		expect(isSuccess(org) && org.data?.href).toBe("https://rdap.publicinterestregistry.org/rdap/");
	});

	test("prefers an entry's HTTPS URL and uses HTTP only when it is the sole URL", async () => {
		ianaServes();
		let rdap = client();

		let io = await rdap.server("acme.io");
		let tv = await rdap.server("acme.tv");

		expect(isSuccess(io) && io.data?.href).toBe("https://rdap.identitydigital.services/rdap/");
		expect(isSuccess(tv) && tv.data?.href).toBe("http://rdap.nic.tv/");
	});

	test("consults servers overrides first, by the longest matching suffix", async () => {
		ianaServes();
		let rdap = client({
			servers: {
				"co.uk": "https://rdap.couk-registry.com/rdap",
				".com": "https://rdap.override.com/",
			},
		});

		let couk = await rdap.server("acme.co.uk");
		let uk = await rdap.server("acme.uk");
		let com = await rdap.server("acme.com");

		expect(isSuccess(couk) && couk.data?.href).toBe("https://rdap.couk-registry.com/rdap/");
		expect(isSuccess(uk) && uk.data?.href).toBe("https://rdap.nominet.uk/uk/");
		expect(isSuccess(com) && com.data?.href).toBe("https://rdap.override.com/");
	});

	test("answers null for a TLD nothing lists", async () => {
		ianaServes();
		let result = await client().server("acme.zz");
		expect(isSuccess(result) && result.data).toBeNull();
	});
});

describe("the bootstrap file", () => {
	test("is fetched once per instance, concurrent lookups included", async () => {
		let iana = ianaServes();
		let rdap = client();

		await Promise.all([rdap.server("a.com"), rdap.server("b.org"), rdap.server("c.ch")]);
		await rdap.server("d.com");

		expect(iana.hits).toBe(1);
	});

	test("is read from the shared cache by another instance", async () => {
		let iana = ianaServes();
		let cache = new MemoryCache();

		await client({ cache }).server("a.com");
		let result = await client({ cache }).server("b.org");

		expect(isSuccess(result) && result.data?.host).toBe("rdap.publicinterestregistry.org");
		expect(iana.hits).toBe(1);
	});

	test("is refreshed once its copy is older than bootstrapTtl", async () => {
		let iana = ianaServes();
		let cache = new MemoryCache();
		await cache.write("rdap:bootstrap:dns", {
			fetchedAt: Date.now() - 2 * 86_400_000,
			services: { com: ["https://rdap.stale-registry.com/"] },
		});

		let result = await client({ cache }).server("a.com");

		expect(isSuccess(result) && result.data?.href).toBe("https://rdap.verisign.com/com/v1/");
		expect(iana.hits).toBe(1);
	});

	test("serves an expired copy when IANA fails", async () => {
		server.use(http.get(IANA, () => new HttpResponse(null, { status: 503 })));
		let cache = new MemoryCache();
		await cache.write("rdap:bootstrap:dns", {
			fetchedAt: 0,
			services: { com: ["https://rdap.stale-registry.com/"] },
		});

		let result = await client({ cache }).server("a.com");

		expect(isSuccess(result) && result.data?.href).toBe("https://rdap.stale-registry.com/");
	});

	test("fails bootstrap-unavailable when it has never been fetched", async () => {
		server.use(http.get(IANA, () => HttpResponse.error()));

		let error = errorOf(await client().domain("acme-widgets.com"));

		expect(error.code).toBe("bootstrap-unavailable");
		expect(error.retryable).toBe(true);
		expect((error.cause as RDAPError).code).toBe("network");
	});

	test("fails bootstrap-unavailable when IANA answers something other than a bootstrap file", async () => {
		server.use(http.get(IANA, () => HttpResponse.json({ services: "none" })));

		let error = errorOf(await client().server("acme.com"));

		expect(error.code).toBe("bootstrap-unavailable");
		expect((error.cause as RDAPError).code).toBe("invalid-response");
	});

	test("reads from a configured mirror", async () => {
		let hits = 0;
		server.use(
			http.get("https://rdap-mirror.com/dns.json", () => {
				hits++;
				return HttpResponse.json(BOOTSTRAP);
			}),
		);

		let result = await client({ bootstrap: "https://rdap-mirror.com/dns.json" }).server("a.com");

		expect(isSuccess(result)).toBe(true);
		expect(hits).toBe(1);
	});
});

describe("RDAPError codes", () => {
	test.each([
		"com",
		"",
		".",
		"1.2.3.4",
		"[::1]",
		"a/b.com",
		"exa mple.com",
		"user@acme.com",
		"a..com",
	])("invalid-domain for %j", async (name) => {
		let error = errorOf(await client().domain(name));
		expect(error.code).toBe("invalid-domain");
		expect(error.domain).toBe(name);
		expect(error.retryable).toBe(false);
	});

	test("unsupported-tld names the TLD", async () => {
		ianaServes();
		let error = errorOf(await client().domain("acme.zz"));
		expect(error.code).toBe("unsupported-tld");
		expect(error.tld).toBe("zz");
		expect(error.retryable).toBe(false);
	});

	test("not-found for a 404", async () => {
		ianaServes();
		server.use(
			http.get(`${VERISIGN}/unregistered.com`, () => new HttpResponse(null, { status: 404 })),
		);

		let error = errorOf(await client().domain("unregistered.com"));

		expect(error.code).toBe("not-found");
		expect(error.url).toBe(`${VERISIGN}/unregistered.com`);
		expect(error.retryable).toBe(false);
	});

	test("rate-limited reads Retry-After in seconds", async () => {
		ianaServes();
		server.use(
			http.get(
				`${VERISIGN}/acme.com`,
				() => new HttpResponse(null, { status: 429, headers: { "retry-after": "120" } }),
			),
		);

		let error = errorOf(await client().domain("acme.com"));

		expect(error.code).toBe("rate-limited");
		expect(error.retryAfter).toBe(120_000);
		expect(error.retryable).toBe(true);
	});

	test("rate-limited reads Retry-After as an HTTP date", async () => {
		ianaServes();
		let at = new Date(Date.now() + 90_000).toUTCString();
		server.use(
			http.get(
				`${VERISIGN}/acme.com`,
				() => new HttpResponse(null, { status: 429, headers: { "retry-after": at } }),
			),
		);

		let error = errorOf(await client().domain("acme.com"));

		expect(error.retryAfter).toBeGreaterThan(80_000);
		expect(error.retryAfter).toBeLessThanOrEqual(90_000);
	});

	test("rate-limited without Retry-After leaves retryAfter null", async () => {
		ianaServes();
		server.use(http.get(`${VERISIGN}/acme.com`, () => new HttpResponse(null, { status: 429 })));

		let error = errorOf(await client().domain("acme.com"));

		expect(error.code).toBe("rate-limited");
		expect(error.retryAfter).toBeNull();
	});

	test("server-error for a 5xx, with the status", async () => {
		ianaServes();
		server.use(http.get(`${VERISIGN}/acme.com`, () => new HttpResponse(null, { status: 503 })));

		let error = errorOf(await client().domain("acme.com"));

		expect(error.code).toBe("server-error");
		expect(error.status).toBe(503);
		expect(error.retryable).toBe(true);
	});

	test("refused for any other non-2xx", async () => {
		ianaServes();
		server.use(http.get(`${VERISIGN}/acme.com`, () => new HttpResponse(null, { status: 403 })));

		let error = errorOf(await client().domain("acme.com"));

		expect(error.code).toBe("refused");
		expect(error.status).toBe(403);
		expect(error.retryable).toBe(false);
	});

	test("refused for a redirect to a private address", async () => {
		ianaServes();
		server.use(
			http.get(`${VERISIGN}/acme.com`, () =>
				HttpResponse.redirect("http://10.0.0.1/domain/acme.com", 302),
			),
		);

		let error = errorOf(await client().domain("acme.com"));

		expect(error.code).toBe("refused");
		expect(error.url).toBe("http://10.0.0.1/domain/acme.com");
	});

	test("refused for a chain longer than three redirects", async () => {
		ianaServes();
		server.use(
			http.get("https://rdap.loop-registry.com/:n", ({ params }) =>
				HttpResponse.redirect(`https://rdap.loop-registry.com/${Number(params.n) + 1}`, 302),
			),
			http.get(`${VERISIGN}/acme.com`, () =>
				HttpResponse.redirect("https://rdap.loop-registry.com/1", 302),
			),
		);

		let error = errorOf(await client().domain("acme.com"));

		expect(error.code).toBe("refused");
		expect((error.cause as { code: string }).code).toBe("too-many-redirects");
	});

	test("invalid-response for a 200 HTML page", async () => {
		ianaServes();
		server.use(http.get(`${VERISIGN}/acme.com`, () => HttpResponse.html("<h1>Oops</h1>")));

		let error = errorOf(await client().domain("acme.com"));

		expect(error.code).toBe("invalid-response");
		expect(error.retryable).toBe(false);
	});

	test("invalid-response for an object that is not a domain", async () => {
		ianaServes();
		server.use(registry(`${VERISIGN}/acme.com`, { objectClassName: "entity", handle: "X" }));

		let error = errorOf(await client().domain("acme.com"));

		expect(error.code).toBe("invalid-response");
	});

	test("invalid-response for a domain whose read fields have the wrong shape", async () => {
		ianaServes();
		server.use(registry(`${VERISIGN}/acme.com`, { objectClassName: "domain", status: "active" }));

		let error = errorOf(await client().domain("acme.com"));

		expect(error.code).toBe("invalid-response");
	});

	test("too-large for a body past maxBytes", async () => {
		ianaServes();
		server.use(registry(`${VERISIGN}/acme-widgets.com`, THIN_COM));

		let error = errorOf(await client({ maxBytes: 256 }).domain("acme-widgets.com"));

		expect(error.code).toBe("too-large");
		expect(error.retryable).toBe(false);
	});

	test("timeout when the registry answers after the deadline", async () => {
		ianaServes();
		let rdap = client({ timeout: 100 });
		await rdap.server("acme.com");
		server.use(
			http.get(`${VERISIGN}/acme.com`, async () => {
				await delay(1000);
				return HttpResponse.json(THIN_COM);
			}),
		);

		let error = errorOf(await rdap.domain("acme.com"));

		expect(error.code).toBe("timeout");
		expect(error.retryable).toBe(true);
	});

	test("network when the connection fails", async () => {
		ianaServes();
		server.use(http.get(`${VERISIGN}/acme.com`, () => HttpResponse.error()));

		let error = errorOf(await client().domain("acme.com"));

		expect(error.code).toBe("network");
		expect(error.retryable).toBe(true);
	});
});
