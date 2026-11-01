/**
 * Tests for the `sdxc-http-signatures` command line: `sign` output in each form, `verify`
 * against the draft-cavage-12 published signature and against what `sign` wrote, and the exit
 * code for a bad signature and for bad input, with the key set URL served by MSW.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { InvokeOptions } from "@sdxc/cli/test";

import { invoke } from "@sdxc/cli/test";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import { cli } from "./cli.js";
import { CAVAGE_PUBLIC_PEM, ED25519_PRIVATE_PEM, ED25519_PUBLIC_PEM } from "./fixtures/keys.js";

const JWKS_URL = "https://bot.sdxc.dev/.well-known/http-message-signatures-directory";

/** The draft-cavage-12 Appendix C request, signed as its C.3 example signs it. */
const CAVAGE_C3_REQUEST = [
	"POST /foo?param=value&pet=dog HTTP/1.1",
	"Host: example.com",
	"Date: Sun, 05 Jan 2014 21:31:40 GMT",
	"Content-Type: application/json",
	"Digest: SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=",
	"Content-Length: 18",
	'Signature: keyId="Test",algorithm="rsa-sha256",headers="(request-target) host date content-type digest content-length",signature="vSdrb+dS3EceC9bcwHSo4MlyKS59iFIrhgYkz8+oVLEEzmYZZvRs8rgOp+63LEM3v+MFHB32NfpB2bEKBIvB1q52LaEUHFv120V01IL+TAD48XaERZFukWgHoBTLMhYS2Gb51gWxpeIq8knRmPnYePbF5MOkR0Zkly4zKH7s1dE="',
	"",
	'{"hello": "world"}',
].join("\r\n");

/** The time the draft-cavage-12 example was signed at. */
const CAVAGE_NOW = "2014-01-05T21:31:40Z";

const server = setupServer();

let dir = "";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "sdxc-http-signatures-"));
	await file("private.pem", ED25519_PRIVATE_PEM);
	await file("public.pem", ED25519_PUBLIC_PEM);
	await file("note.json", '{"type":"Note"}');
});

afterEach(async () => {
	server.resetHandlers();
	await rm(dir, { recursive: true, force: true });
});

afterAll(() => server.close());

/** Runs `sdxc-http-signatures` in the test's directory with no environment but what `options` gives. */
function run(argv: string[], options: InvokeOptions = {}) {
	return invoke(cli, argv, { cwd: dir, env: {}, ...options });
}

/** Writes `text` into the test's directory and answers its name. */
async function file(name: string, text: string): Promise<string> {
	await writeFile(join(dir, name), text, "utf8");
	return name;
}

/**
 * A raw request built from what `sign --json` printed, as a verifier receives it.
 *
 * @param stdout - The JSON report.
 * @param extra - Headers the request carried before signing.
 * @param body - The body sent.
 */
function rawRequest(stdout: string, extra: string[] = [], body = ""): string {
	let report = JSON.parse(stdout) as {
		method: string;
		url: string;
		headers: Record<string, string>;
	};
	let url = new URL(report.url);
	let lines = [
		`${report.method} ${url.pathname}${url.search} HTTP/1.1`,
		`Host: ${url.host}`,
		...extra,
		...Object.entries(report.headers).map(([name, value]) => `${name}: ${value}`),
	];
	return `${lines.join("\r\n")}\r\n\r\n${body}`;
}

describe("sign", () => {
	test("prints the headers signing wrote", async () => {
		let result = await run([
			"sign",
			"post",
			"https://sdxc.dev/inbox",
			"-H",
			"content-type:application/json",
			"--body-file",
			"note.json",
			"--key-file",
			"private.pem",
			"--key-id",
			"https://sdxc.dev/actor#main-key",
		]);
		expect(result.stderr).toBe("");
		expect(result.code).toBe(0);
		expect(result.stdout).toMatch(/^Date: .+ GMT$/m);
		expect(result.stdout).toMatch(/^Content-Digest: sha-256=:.+:$/m);
		expect(result.stdout).toContain(
			'Signature-Input: sig1=("@method" "@target-uri" "content-digest" "content-type" "date");created=',
		);
		expect(result.stdout).toContain('keyid="https://sdxc.dev/actor#main-key"');
		expect(result.stdout).toMatch(/^Signature: sig1=:.+:$/m);
		expect(result.stdout).not.toContain("Content-Type");
	});

	test("signs under draft-cavage with the components given, reading the key from the environment", async () => {
		let result = await run(
			[
				"sign",
				"GET",
				"https://sdxc.dev/feed",
				"--scheme",
				"draft-cavage",
				"--key-env",
				"SIGNING_KEY",
				"--key-id",
				"key-1",
				"--components",
				"(request-target), host date",
			],
			{ env: { SIGNING_KEY: ED25519_PRIVATE_PEM } },
		);
		expect(result.code).toBe(0);
		expect(result.stdout).toMatch(
			/^Signature: keyId="key-1",algorithm="hs2019",headers="\(request-target\) host date",signature=".+"$/m,
		);
	});

	test("prints a curl command carrying every header and the body file", async () => {
		let result = await run([
			"sign",
			"POST",
			"https://sdxc.dev/inbox",
			"--body-file",
			"note.json",
			"--key-file",
			"private.pem",
			"--key-id",
			"k",
			"--curl",
		]);
		expect(result.code).toBe(0);
		expect(result.stdout).toMatch(/^curl -X POST 'https:\/\/sdxc.dev\/inbox' -H 'Content-Digest: /);
		expect(result.stdout).toMatch(/-H 'Date: [^']+ GMT'/);
		expect(result.stdout).toContain("-H 'Signature-Input: sig1=");
		expect(result.stdout).toContain("--data-binary '@note.json'");
	});

	test("reads parameterized components as Signature-Input writes them", async () => {
		let result = await run([
			"sign",
			"GET",
			"https://sdxc.dev/search?q=cats",
			"--key-file",
			"private.pem",
			"--key-id",
			"k",
			"--components",
			'@method @authority @path @query-param;name="q" date',
			"--label",
			"proxy",
			"--tag",
			"debug",
			"--json",
		]);
		expect(result.code).toBe(0);
		let report = JSON.parse(result.stdout) as { headers: Record<string, string> };
		expect(report.headers["signature-input"]).toMatch(
			/^proxy=\("@method" "@authority" "@path" "@query-param";name="q" "date"\);created=\d+;keyid="k";tag="debug"$/,
		);
	});

	test("refuses a key and a body both on stdin", async () => {
		let result = await run([
			"sign",
			"POST",
			"https://sdxc.dev/inbox",
			"--body-file",
			"-",
			"--key-file",
			"-",
			"--key-id",
			"k",
		]);
		expect(result.code).toBe(2);
		expect(result.stderr).toContain("Only one of the key and the body can come from stdin");
	});

	test("exits 2 for a public key, a relative URL or a component the request lacks", async () => {
		let base = ["--key-file", "private.pem", "--key-id", "k"];
		let publicKey = await run([
			"sign",
			"GET",
			"https://sdxc.dev/",
			"--key-file",
			"public.pem",
			"--key-id",
			"k",
		]);
		expect(publicKey.code).toBe(2);
		expect(publicKey.stderr).toContain(
			"Cannot use public.pem: The key is not a JWK or a PEM PRIVATE KEY",
		);

		let relative = await run(["sign", "GET", "/inbox", ...base]);
		expect(relative.code).toBe(2);
		expect(relative.stderr).toContain("Expected an absolute http(s) URL; got /inbox");

		let missing = await run([
			"sign",
			"GET",
			"https://sdxc.dev/",
			...base,
			"--components",
			"@method x-missing",
		]);
		expect(missing.code).toBe(2);
		expect(missing.stderr).toContain(
			"Cannot sign (missing-component): The request has no x-missing",
		);
	});
});

describe("verify", () => {
	test("verifies the draft-cavage-12 published signature", async () => {
		await file("request.http", CAVAGE_C3_REQUEST);
		await file("cavage.pem", CAVAGE_PUBLIC_PEM);
		let result = await run([
			"verify",
			"request.http",
			"--key-file",
			"cavage.pem",
			"--now",
			CAVAGE_NOW,
		]);
		expect(result.stderr).toBe("");
		expect(result.code).toBe(0);
		expect(result.stdout).toBe(
			[
				"Valid draft-cavage signature by Test",
				"Created: 2014-01-05T21:31:40.000Z",
				"Covers: (request-target) host date content-type digest content-length",
				"",
			].join("\n"),
		);
	});

	test("exits 1 for a tampered request, naming the check and the coverage", async () => {
		await file("cavage.pem", CAVAGE_PUBLIC_PEM);
		let tampered = CAVAGE_C3_REQUEST.replace("Host: example.com", "Host: example.org");
		let result = await run(["verify", "--key-file", "cavage.pem", "--now", CAVAGE_NOW], {
			stdin: tampered,
		});
		expect(result.code).toBe(1);
		expect(result.stderr).toContain(
			"Invalid signature (invalid-signature): The signature does not verify",
		);
		expect(result.stderr).toContain(
			"Covers: (request-target) host date content-type digest content-length",
		);
	});

	test("names the digest when the body was changed", async () => {
		await file("cavage.pem", CAVAGE_PUBLIC_PEM);
		await file("request.http", CAVAGE_C3_REQUEST.replace('"world"', '"there"'));
		let result = await run([
			"verify",
			"request.http",
			"--key-file",
			"cavage.pem",
			"--now",
			CAVAGE_NOW,
			"--json",
		]);
		expect(result.code).toBe(1);
		expect(JSON.parse(result.stdout)).toMatchObject({ valid: false, code: "digest-mismatch" });
	});

	test("exits 1 for a stale signature", async () => {
		await file("request.http", CAVAGE_C3_REQUEST);
		await file("cavage.pem", CAVAGE_PUBLIC_PEM);
		let result = await run(["verify", "request.http", "--key-file", "cavage.pem"]);
		expect(result.code).toBe(1);
		expect(result.stderr).toContain("Invalid signature (stale-signature)");
	});

	test("verifies what sign wrote, body included", async () => {
		let signed = await run([
			"sign",
			"POST",
			"https://sdxc.dev/inbox",
			"-H",
			"content-type:application/json",
			"--body-file",
			"note.json",
			"--key-file",
			"private.pem",
			"--key-id",
			"k",
			"--json",
		]);
		await file(
			"request.http",
			rawRequest(signed.stdout, ["Content-Type: application/json"], '{"type":"Note"}'),
		);
		let result = await run(["verify", "request.http", "--key-file", "public.pem", "--json"]);
		expect(result.code).toBe(0);
		expect(JSON.parse(result.stdout)).toMatchObject({
			valid: true,
			scheme: "rfc9421",
			label: "sig1",
			keyId: "k",
			components: ["@method", "@target-uri", "content-digest", "content-type", "date"],
		});
	});

	test("picks the key whose kid is the keyid from a key set URL", async () => {
		let jwk = await crypto.subtle.exportKey(
			"jwk",
			await crypto.subtle.importKey(
				"spki",
				new Uint8Array(
					Buffer.from(ED25519_PUBLIC_PEM.replaceAll(/-----[^-]+-----|\s/g, ""), "base64"),
				),
				{ name: "Ed25519" },
				true,
				["verify"],
			),
		);
		server.use(
			http.get(JWKS_URL, () =>
				HttpResponse.json({
					keys: [
						{ ...jwk, kid: "other" },
						{ ...jwk, kid: "bot-key" },
					],
				}),
			),
		);
		let signed = await run([
			"sign",
			"GET",
			"https://sdxc.dev/",
			"--key-file",
			"private.pem",
			"--key-id",
			"bot-key",
			"--components",
			"@method @target-uri @authority date",
			"--json",
		]);
		let result = await run(["verify", "--jwks", JWKS_URL], { stdin: rawRequest(signed.stdout) });
		expect(result.stderr).toBe("");
		expect(result.code).toBe(0);
		expect(result.stdout).toContain("Valid rfc9421 signature sig1 by bot-key");
	});

	test("exits 1 when no key matches the keyid", async () => {
		server.use(http.get(JWKS_URL, () => HttpResponse.json({ keys: [] })));
		await file("request.http", CAVAGE_C3_REQUEST);
		let result = await run(["verify", "request.http", "--jwks", JWKS_URL, "--now", CAVAGE_NOW]);
		expect(result.code).toBe(1);
		expect(result.stderr).toContain("Invalid signature (key-unavailable): No key for Test");
	});

	test("exits 2 for a key that will not import, an unreadable request or no key flag", async () => {
		await file("request.http", CAVAGE_C3_REQUEST);
		await file("garbage.pem", "not a key");
		let garbage = await run([
			"verify",
			"request.http",
			"--key-file",
			"garbage.pem",
			"--now",
			CAVAGE_NOW,
		]);
		expect(garbage.code).toBe(2);
		expect(garbage.stderr).toContain(
			"Cannot use the key: The key is not a JWK or a PEM PUBLIC KEY",
		);

		let missing = await run(["verify", "nope.http", "--key-file", "public.pem"]);
		expect(missing.code).toBe(2);
		expect(missing.stderr).toContain("Cannot read nope.http");

		let noKey = await run(["verify", "request.http"]);
		expect(noKey.code).toBe(2);
		expect(noKey.stderr).toContain(
			"Pass exactly one of --jwks <url>, --key-file <path> or --key-env <name>",
		);

		await file("headless.http", "not a request");
		let headless = await run(["verify", "headless.http", "--key-file", "public.pem"]);
		expect(headless.code).toBe(2);
		expect(headless.stderr).toContain("headless.http does not start with a request line");
	});
});
