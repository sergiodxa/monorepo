/**
 * Tests for the `sdxc-rdap` command line: what `lookup` and `expires` print on each stream and
 * the exit code they answer for a thin, thick, unexpiring and unknown registration, against
 * MSW-mocked IANA and registry servers, driven through `invoke()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JsonBodyType } from "msw";

import { invoke } from "@sdxc/cli/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

import { cli } from "./cli.js";
import {
	BOOTSTRAP,
	IDN_COM,
	NO_EXPIRY_CH,
	REGISTRAR_COM,
	THICK_ORG,
	THIN_COM,
} from "./fixtures/registries.js";

const IANA = "https://data.iana.org/rdap/dns.json";
const VERISIGN = "https://rdap.verisign.com/com/v1/domain";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(new Date("2026-10-31T00:00:00Z"));
	server.use(http.get(IANA, () => HttpResponse.json(BOOTSTRAP)));
});
afterEach(() => {
	vi.useRealTimers();
	server.resetHandlers();
});
afterAll(() => server.close());

/** Answers `body` as RDAP JSON at `url`. */
function registry(url: string, body: JsonBodyType) {
	return http.get(url, () =>
		HttpResponse.json(body, { headers: { "content-type": "application/rdap+json" } }),
	);
}

/** Runs `sdxc-rdap` with no terminal attached. */
function run(argv: string[]) {
	return invoke(cli, argv, { interactive: false });
}

describe("sdxc-rdap lookup", () => {
	test("prints a labelled summary of the registration", async () => {
		server.use(registry(`${VERISIGN}/acme-widgets.com`, THIN_COM));

		let { code, stdout, stderr } = await run(["lookup", "acme-widgets.com"]);

		expect(code).toBe(0);
		expect(stderr).toBe("");
		expect(stdout).toContain("Domain       acme-widgets.com\n");
		expect(stdout).toContain("Expires      2028-09-14 (in 684 days)\n");
		expect(stdout).toContain("Registered   1997-09-15\n");
		expect(stdout).toContain(
			"Status       clientDeleteProhibited, clientTransferProhibited, clientUpdateProhibited\n",
		);
		expect(stdout).toContain("Registrar    Example Registrar, LLC (IANA 9999)\n");
		expect(stdout).toContain("Abuse        not published\n");
		expect(stdout).toContain("Nameservers  ns1.exampledns.com, ns2.exampledns.com\n");
		expect(stdout).toContain("DNSSEC       unsigned\n");
		expect(stdout).toContain(
			"Contacts     registrar: Example Registrar, LLC\n             abuse: no details published\n",
		);
		expect(stdout).toContain(`Server       ${VERISIGN}/acme-widgets.com\n`);
	});

	test("fills the registrar's abuse email from its own server with --related", async () => {
		server.use(
			registry(`${VERISIGN}/acme-widgets.com`, THIN_COM),
			registry("https://rdap.exampleregistrar.com/domain/ACME-WIDGETS.COM", REGISTRAR_COM),
		);

		let { code, stdout } = await run(["lookup", "acme-widgets.com", "--related"]);

		expect(code).toBe(0);
		expect(stdout).toContain("Abuse        abuse@exampleregistrar.com\n");
	});

	test("prints the domain model without the raw document under --json", async () => {
		server.use(
			registry("https://rdap.publicinterestregistry.org/rdap/domain/acme-widgets.org", THICK_ORG),
		);

		let { code, stdout } = await run(["lookup", "acme-widgets.org", "--json"]);
		let report = JSON.parse(stdout) as { contacts: object[] };

		expect(code).toBe(0);
		expect(report).toMatchObject({
			name: "acme-widgets.org",
			expiresAt: Date.parse("2027-03-11T10:20:30.000Z"),
			updatedAt: null,
			status: ["clientTransferProhibited", "serverHold", "renew prohibited"],
			registrar: {
				name: "Org Registrar Inc.",
				ianaId: "1234",
				abuseEmail: "abuse@orgregistrar.com",
			},
			nameservers: ["ns1.orghost.net"],
			dnssec: true,
		});
		expect(report).not.toHaveProperty("document");
		expect(report.contacts[0]).not.toHaveProperty("card");
	});

	test("says what the registry left out", async () => {
		server.use(registry("https://rdap.nic.ch/domain/acme-widgets.ch", NO_EXPIRY_CH));

		let { code, stdout } = await run(["lookup", "acme-widgets.ch"]);

		expect(code).toBe(0);
		expect(stdout).toContain("Expires      not published\n");
		expect(stdout).toContain("Registrar    not published\n");
		expect(stdout).toContain("DNSSEC       not published\n");
		expect(stdout).toContain("Contacts     none published\n");
	});

	test("exits 1 with the error code when the registry has no such domain", async () => {
		server.use(http.get(`${VERISIGN}/missing.com`, () => new HttpResponse(null, { status: 404 })));

		let { code, stdout, stderr } = await run(["lookup", "missing.com"]);

		expect(code).toBe(1);
		expect(stdout).toBe("");
		expect(stderr).toContain("not-found:");
	});

	test("reports the failure as JSON on stdout under --json", async () => {
		server.use(http.get(`${VERISIGN}/busy.com`, () => new HttpResponse(null, { status: 503 })));

		let { code, stdout } = await run(["lookup", "busy.com", "--json"]);

		expect(code).toBe(1);
		expect(JSON.parse(stdout)).toEqual({
			error: { code: "server-error", message: expect.any(String), retryable: true },
		});
	});

	test("exits 1 for a TLD no registry lists", async () => {
		let { code, stderr } = await run(["lookup", "example.zz"]);

		expect(code).toBe(1);
		expect(stderr).toContain("unsupported-tld:");
	});

	test("exits 2 for a name that is no domain", async () => {
		let { code, stderr } = await run(["lookup", "localhost"]);

		expect(code).toBe(2);
		expect(stderr).not.toBe("");
	});
});

describe("sdxc-rdap expires", () => {
	test("exits 0 when the expiry lies past the window", async () => {
		server.use(registry(`${VERISIGN}/xn--bcher-kva.com`, IDN_COM));

		let { code, stdout } = await run(["expires", "bücher.com", "--within", "30 days"]);

		expect(code).toBe(0);
		expect(stdout).toBe(
			"xn--bcher-kva.com expires on 2027-01-31, after the window ends on 2026-11-30\n",
		);
	});

	test("exits 1 when the expiry falls inside the window", async () => {
		server.use(registry(`${VERISIGN}/xn--bcher-kva.com`, IDN_COM));

		let { code, stdout } = await run(["expires", "xn--bcher-kva.com", "--within", "100d"]);

		expect(code).toBe(1);
		expect(stdout).toBe(
			"xn--bcher-kva.com expires on 2027-01-31, before the window ends on 2027-02-08\n",
		);
	});

	test("exits 1 when the domain has already expired", async () => {
		vi.setSystemTime(new Date("2027-02-15T00:00:00Z"));
		server.use(registry(`${VERISIGN}/xn--bcher-kva.com`, IDN_COM));

		let { code, stdout } = await run(["expires", "xn--bcher-kva.com", "--within", "1d"]);

		expect(code).toBe(1);
		expect(stdout).toBe("xn--bcher-kva.com expired on 2027-01-31\n");
	});

	test("exits 1 when the registry publishes no expiry", async () => {
		server.use(registry("https://rdap.nic.ch/domain/acme-widgets.ch", NO_EXPIRY_CH));

		let { code, stdout } = await run(["expires", "acme-widgets.ch", "--within", "30d", "--json"]);

		expect(code).toBe(1);
		expect(JSON.parse(stdout)).toEqual({
			domain: "acme-widgets.ch",
			expiresAt: null,
			windowEndsAt: Date.parse("2026-11-30T00:00:00Z"),
			expiring: true,
		});
	});

	test("prints the comparison as JSON", async () => {
		server.use(registry(`${VERISIGN}/acme-widgets.com`, THIN_COM));

		let { code, stdout } = await run(["expires", "acme-widgets.com", "--within", "2w", "--json"]);

		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toEqual({
			domain: "acme-widgets.com",
			expiresAt: Date.parse("2028-09-14T04:00:00Z"),
			windowEndsAt: Date.parse("2026-11-14T00:00:00Z"),
			expiring: false,
		});
	});

	test("exits 2 without --within or with a window that is no duration", async () => {
		let missing = await run(["expires", "acme-widgets.com"]);
		let malformed = await run(["expires", "acme-widgets.com", "--within", "soon"]);

		expect(missing.code).toBe(2);
		expect(malformed.code).toBe(2);
		expect(malformed.stderr).toContain("expects a duration");
	});
});
