/**
 * Tests for the `sdxc-well-known` command line through `invoke()`: security.txt checks from an
 * origin, a file and stdin, and `fetch` for each kind of document, asserting stdout, stderr and
 * the exit code with every origin served by MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import { cli } from "./cli.js";
import { NODEINFO_2_0, NODEINFO_2_1 } from "./nodeinfo.js";

const ORIGIN = "https://sdxc.dev";

const ISSUER = "https://auth.sdxc.dev";

/** A security.txt that stays valid for decades. */
const SECURITY_TXT = [
	"Contact: mailto:security@sdxc.dev",
	"Expires: 2099-12-31T00:00:00Z",
	"Preferred-Languages: en",
	"",
].join("\n");

/** A security.txt past its expiry, otherwise valid. */
const EXPIRED_TXT = "Contact: mailto:security@sdxc.dev\nExpires: 2021-12-31T18:37:07Z\n";

/** OpenID Connect Discovery metadata naming {@link ISSUER}. */
const OPENID_CONFIGURATION = {
	issuer: ISSUER,
	authorization_endpoint: `${ISSUER}/authorize`,
	token_endpoint: `${ISSUER}/token`,
	jwks_uri: `${ISSUER}/.well-known/jwks.json`,
	response_types_supported: ["code"],
	subject_types_supported: ["public"],
	id_token_signing_alg_values_supported: ["ES256"],
};

/** A NodeInfo 2.1 document. */
const NODEINFO = {
	version: "2.1",
	software: { name: "sdxc", version: "1.0.0" },
	protocols: ["activitypub"],
	services: { inbound: [], outbound: [] },
	openRegistrations: false,
	usage: { users: { total: 1 } },
	metadata: {},
};

const server = setupServer();

let directory = "";

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });
	directory = await mkdtemp(join(tmpdir(), "sdxc-well-known-"));
	await writeFile(join(directory, "security.txt"), SECURITY_TXT);
	await writeFile(join(directory, "expired.txt"), EXPIRED_TXT);
});

afterEach(() => server.resetHandlers());

afterAll(async () => {
	server.close();
	await rm(directory, { recursive: true, force: true });
});

/** Runs `sdxc-well-known` in the fixture directory, with `stdin` piped when given. */
function run(argv: string[], stdin?: string) {
	return invoke(cli, argv, { cwd: directory, ...(stdin === undefined ? {} : { stdin }) });
}

describe("security-txt check", () => {
	test("fetches an origin's /.well-known/security.txt", async () => {
		server.use(
			http.get(`${ORIGIN}/.well-known/security.txt`, () => HttpResponse.text(SECURITY_TXT)),
		);

		let { code, stdout, stderr } = await run(["security-txt", "check", `${ORIGIN}/about`]);

		expect(stderr).toBe("");
		expect(code).toBe(0);
		expect(stdout).toBe(
			`${ORIGIN}/.well-known/security.txt: valid, expires 2099-12-31T00:00:00.000Z\n`,
		);
	});

	test("reads a file and reports it as JSON", async () => {
		let { code, stdout } = await run(["security-txt", "check", "security.txt", "--json"]);

		expect(code).toBe(0);
		expect(JSON.parse(stdout)).toEqual({
			source: "security.txt",
			valid: true,
			signed: false,
			expires: "2099-12-31T00:00:00.000Z",
			issues: [],
		});
	});

	test("exits 1 on an expired file", async () => {
		let { code, stdout } = await run(["security-txt", "check", "expired.txt"]);

		expect(code).toBe(1);
		expect(stdout).toBe("expired.txt: Expires 2021-12-31T18:37:07.000Z has passed.\n");
	});

	test("exits 1 listing every missing field, with lines, from stdin", async () => {
		let { code, stdout } = await run(["security-txt", "check"], "Policy: http://sdxc.dev\n");

		expect(code).toBe(1);
		expect(stdout).toContain("<stdin>:1: ");
		expect(stdout).toContain("<stdin>: The file has no Contact field.\n");
		expect(stdout).toContain("<stdin>: The file has no Expires field.\n");
	});

	test("exits 1 when the origin serves none", async () => {
		server.use(
			http.get(`${ORIGIN}/.well-known/security.txt`, () => new HttpResponse(null, { status: 404 })),
		);

		let { code, stdout } = await run(["security-txt", "check", ORIGIN, "--json"]);

		expect(code).toBe(1);
		expect(JSON.parse(stdout)).toMatchObject({
			valid: false,
			signed: null,
			expires: null,
			issues: [{ at: 0, message: "The server answered HTTP 404." }],
		});
	});

	test("exits 2 on a file it cannot read", async () => {
		let { code, stderr } = await run(["security-txt", "check", "missing.txt"]);

		expect(code).toBe(2);
		expect(stderr).toContain("Cannot read missing.txt");
	});

	test("exits 2 when the origin cannot be reached", async () => {
		server.use(http.get(`${ORIGIN}/.well-known/security.txt`, () => HttpResponse.error()));

		let { code, stderr } = await run(["security-txt", "check", ORIGIN]);

		expect(code).toBe(2);
		expect(stderr).toContain(`Cannot fetch ${ORIGIN}/.well-known/security.txt`);
	});
});

describe("fetch", () => {
	test("prints OpenID Connect metadata served after the issuer's path", async () => {
		server.use(
			http.get(`${ISSUER}/tenant/.well-known/openid-configuration`, () =>
				HttpResponse.json({ ...OPENID_CONFIGURATION, issuer: `${ISSUER}/tenant` }),
			),
		);

		let { code, stdout, stderr } = await run(["fetch", `${ISSUER}/tenant`, "openid-configuration"]);

		expect(stderr).toBe("");
		expect(code).toBe(0);
		expect((JSON.parse(stdout) as { issuer: string }).issuer).toBe(`${ISSUER}/tenant`);
	});

	test("exits 1 when the metadata names another issuer", async () => {
		server.use(
			http.get(`${ISSUER}/.well-known/oauth-authorization-server`, () =>
				HttpResponse.json({ ...OPENID_CONFIGURATION, issuer: "https://other.sdxc.dev" }),
			),
		);

		let { code, stdout, stderr } = await run(["fetch", ISSUER, "oauth-authorization-server"]);

		expect(code).toBe(1);
		expect(stdout).toBe("");
		expect(stderr).toContain(`${ISSUER}/.well-known/oauth-authorization-server\n`);
		expect(stderr).toContain("/issuer: ");
	});

	test("reports a key set as JSON with the parsed keys", async () => {
		let key = {
			kty: "EC",
			crv: "P-256",
			x: "f83OJ3D2xF1Bg8vub9tLe1gHMzV76e8Tus9uPHvRVEU",
			y: "x_FEzRu9m36HLN_tue659LNpXW6pCyStikYjKIWI5a0",
			kid: "one",
		};
		server.use(
			http.get(`${ORIGIN}/.well-known/jwks.json`, () =>
				HttpResponse.json({ keys: [key, { kid: "broken" }] }),
			),
		);

		let { code, stdout } = await run(["fetch", ORIGIN, "jwks.json", "--json"]);

		expect(code).toBe(0);
		let report = JSON.parse(stdout) as { data: { keys: unknown[]; skipped: number } };
		expect(report).toMatchObject({
			document: "jwks.json",
			url: `${ORIGIN}/.well-known/jwks.json`,
			valid: true,
			issues: [],
		});
		expect(report.data.keys).toEqual([key]);
		expect(report.data.skipped).toBe(1);
	});

	test("asks WebFinger for the resource and relations given", async () => {
		let asked: URL | null = null;
		server.use(
			http.get(`${ORIGIN}/.well-known/webfinger`, ({ request }) => {
				asked = new URL(request.url);
				return HttpResponse.json({
					subject: "acct:sergio@sdxc.dev",
					links: [{ rel: "self", type: "application/activity+json", href: `${ORIGIN}/sergio` }],
				});
			}),
		);

		let { code, stdout } = await run([
			"fetch",
			ORIGIN,
			"webfinger",
			"--resource",
			"acct:sergio@sdxc.dev",
			"--rel",
			"self",
		]);

		expect(code).toBe(0);
		expect(asked).not.toBeNull();
		expect(asked!.searchParams.get("resource")).toBe("acct:sergio@sdxc.dev");
		expect(asked!.searchParams.getAll("rel")).toEqual(["self"]);
		expect((JSON.parse(stdout) as { subject: string }).subject).toBe("acct:sergio@sdxc.dev");
	});

	test("exits 2 for WebFinger without --resource", async () => {
		let { code, stderr } = await run(["fetch", ORIGIN, "webfinger"]);

		expect(code).toBe(2);
		expect(stderr).toContain("--resource");
	});

	test("follows NodeInfo's links to the newest schema", async () => {
		server.use(
			http.get(`${ORIGIN}/.well-known/nodeinfo`, () =>
				HttpResponse.json({
					links: [
						{ rel: NODEINFO_2_0, href: `${ORIGIN}/nodeinfo/2.0` },
						{ rel: NODEINFO_2_1, href: `${ORIGIN}/nodeinfo/2.1` },
					],
				}),
			),
			http.get(`${ORIGIN}/nodeinfo/2.1`, () => HttpResponse.json(NODEINFO)),
		);

		let { code, stdout } = await run(["fetch", ORIGIN, "nodeinfo", "--json"]);

		expect(code).toBe(0);
		let report = JSON.parse(stdout) as { url: string; data: { software: { name: string } } };
		expect(report.url).toBe(`${ORIGIN}/nodeinfo/2.1`);
		expect(report.data.software.name).toBe("sdxc");
	});

	test("exits 1 on a missing document", async () => {
		server.use(
			http.get(
				`${ORIGIN}/.well-known/passkey-endpoints`,
				() => new HttpResponse(null, { status: 404 }),
			),
		);

		let { code, stderr } = await run(["fetch", ORIGIN, "passkey-endpoints"]);

		expect(code).toBe(1);
		expect(stderr).toContain("(document): The server answered HTTP 404.");
	});

	test("exits 2 on an identifier that is not a URL", async () => {
		let { code, stderr } = await run(["fetch", "sdxc.dev", "jwks.json"]);

		expect(code).toBe(2);
		expect(stderr).toContain("Expected an http(s) URL");
	});

	test("exits 2 on a document it does not read", async () => {
		let { code } = await run(["fetch", ORIGIN, "host-meta"]);

		expect(code).toBe(2);
	});
});
