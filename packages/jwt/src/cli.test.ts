/**
 * Tests for the `sdxc-jwt` command line: each command's output, its `--json` report and its
 * exit code, driven through `invoke()` with stdout and stderr captured and the JWKS endpoint
 * served by MSW.
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
import { JWK } from "./jwk.js";
import { JWT } from "./jwt.js";

const JWKS_URL = "https://auth.sdxc.dev/.well-known/jwks.json";

const server = setupServer();

let dir = "";
let pair: JWK.SerializedKeyPair;
let keyPair: JWK.KeyPair;

beforeAll(async () => {
	server.listen({ onUnhandledRequest: "error" });
	pair = await JWK.generateKeyPair(JWK.Algorithm.ES256);
	keyPair = await JWK.importKeyPair(pair);
});

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "sdxc-jwt-"));
});

afterEach(async () => {
	server.resetHandlers();
	await rm(dir, { recursive: true, force: true });
});

afterAll(() => server.close());

/** Runs `sdxc-jwt` in the test's directory with no environment but what `options` gives. */
function jwt(argv: string[], options: InvokeOptions = {}) {
	return invoke(cli, argv, { cwd: dir, env: {}, ...options });
}

/** Writes `text` into the test's directory and answers its name. */
async function file(name: string, text: string): Promise<string> {
	await writeFile(join(dir, name), text, "utf8");
	return name;
}

/** A token signed with the test's key pair. */
function signed(payload: JWT.PayloadInput = {}): Promise<string> {
	return new JWT({ iss: "https://auth.sdxc.dev", sub: "user-123", exp: "1h", ...payload }).sign(
		JWK.Algorithm.ES256,
		[keyPair],
	);
}

describe("decode", () => {
	test("prints the header and the claims", async () => {
		let token = await signed();
		let run = await jwt(["decode", token]);
		expect(run.code).toBe(0);
		expect(run.stdout).toContain('"alg": "ES256"');
		expect(run.stdout).toContain(`"kid": "${pair.id}"`);
		expect(run.stdout).toContain('"sub": "user-123"');
		expect(run.stdout).toMatch(/Token expires at \d{4}-/);
		expect(run.stderr).toBe("");
	});

	test("reads the token from stdin and reports JSON", async () => {
		let token = await signed();
		let run = await jwt(["decode", "--json"], { stdin: `${token}\n` });
		expect(run.code).toBe(0);
		let report = JSON.parse(run.stdout) as { header: { alg: string }; payload: { sub: string } };
		expect(report.header.alg).toBe("ES256");
		expect(report.payload.sub).toBe("user-123");
	});

	test("decodes an expired token without complaint", async () => {
		let run = await jwt(["decode", await signed({ exp: 1 })]);
		expect(run.code).toBe(0);
		expect(run.stdout).toContain("Token expired at 1970-01-01T00:00:01.000Z");
	});

	test("exits 2 on text that is not a JWT", async () => {
		let run = await jwt(["decode", "not-a-token"]);
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Not a JWT");
		expect(run.stdout).toBe("");
	});

	test("exits 2 when stdin is empty", async () => {
		let run = await jwt(["decode"], { stdin: "" });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("No token given");
	});
});

describe("verify", () => {
	test("accepts a token signed by a key in the remote set", async () => {
		server.use(http.get(JWKS_URL, () => HttpResponse.json(JWK.toJSON([keyPair]))));
		let token = await signed();
		let run = await jwt(["verify", token, "--jwks", JWKS_URL, "--iss", "https://auth.sdxc.dev"]);
		expect(run.code).toBe(0);
		expect(run.stdout).toMatch(/^Valid token\n/);
		expect(run.stdout).toContain('"sub": "user-123"');
	});

	test("exits 1 when the issuer differs", async () => {
		server.use(http.get(JWKS_URL, () => HttpResponse.json(JWK.toJSON([keyPair]))));
		let run = await jwt(["verify", await signed(), "--jwks", JWKS_URL, "--iss", "https://other"]);
		expect(run.code).toBe(1);
		expect(run.stderr).toContain('Invalid token: unexpected "iss" claim value');
		expect(run.stdout).toBe("");
	});

	test("exits 1 on an expired token, reporting JSON", async () => {
		let keys = await file("jwks.json", JSON.stringify(JWK.toJSON([keyPair])));
		let run = await jwt(["verify", await signed({ exp: 1 }), "--key-file", keys, "--json"]);
		expect(run.code).toBe(1);
		let report = JSON.parse(run.stdout) as { valid: boolean; error: string };
		expect(report.valid).toBe(false);
		expect(report.error).toContain('"exp" claim timestamp check failed');
	});

	test("exits 1 on a token signed by another key", async () => {
		let other = await JWK.importKeyPair(await JWK.generateKeyPair(JWK.Algorithm.ES256));
		let keys = await file("jwks.json", JSON.stringify(JWK.toJSON([other])));
		let run = await jwt(["verify", await signed(), "--key-file", keys]);
		expect(run.code).toBe(1);
		expect(run.stderr).toContain("Invalid token");
	});

	test("checks the audience and pins the algorithm", async () => {
		let keys = await file("pair.json", JSON.stringify(pair));
		let token = await signed({ aud: "api" });
		let good = await jwt(["verify", token, "--key-file", keys, "--aud", "api", "--alg", "ES256"]);
		expect(good.code).toBe(0);
		let wrongAudience = await jwt(["verify", token, "--key-file", keys, "--aud", "web"]);
		expect(wrongAudience.code).toBe(1);
		let wrongAlgorithm = await jwt(["verify", token, "--key-file", keys, "--alg", "RS256"]);
		expect(wrongAlgorithm.code).toBe(1);
	});

	test("reads a single public JWK and the token from stdin, reporting JSON", async () => {
		let [key] = JWK.toJSON([keyPair]).keys;
		let keys = await file("key.json", JSON.stringify(key));
		let run = await jwt(["verify", "--key-file", keys, "--json"], { stdin: await signed() });
		expect(run.code).toBe(0);
		let report = JSON.parse(run.stdout) as { valid: boolean; payload: { sub: string } };
		expect(report.valid).toBe(true);
		expect(report.payload.sub).toBe("user-123");
	});

	test("exits 2 when the key set cannot be fetched", async () => {
		server.use(http.get(JWKS_URL, () => new HttpResponse(null, { status: 503 })));
		let run = await jwt(["verify", await signed(), "--jwks", JWKS_URL]);
		expect(run.code).toBe(2);
		expect(run.stderr).toContain(`${JWKS_URL} answered 503`);
	});

	test("exits 2 on a key file that holds no key", async () => {
		let keys = await file("keys.json", JSON.stringify({ hello: "world" }));
		let run = await jwt(["verify", await signed(), "--key-file", keys]);
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("is not a JWKS, a JWK or a key pair");
	});

	test("exits 2 without exactly one key source", async () => {
		let run = await jwt(["verify", await signed()]);
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Pass exactly one of --jwks <url> or --key-file <path>");
	});
});

describe("sign", () => {
	test("signs claims from a file with a key pair file", async () => {
		let keys = await file("pair.json", JSON.stringify(pair));
		let claims = await file("claims.json", JSON.stringify({ sub: "user-123", exp: "15m" }));
		let run = await jwt(["sign", claims, "--key-file", keys]);
		expect(run.code).toBe(0);
		let token = await JWT.verify(run.stdout.trim(), [keyPair]);
		expect(token.subject).toBe("user-123");
		expect(token.expiresIn).toBeGreaterThan(14 * 60);
		expect(run.stdout.trim()).not.toContain("\n");
	});

	test("signs claims from stdin with a key pair from an environment variable", async () => {
		let run = await jwt(["sign", "--key-env", "JWT_KEY"], {
			stdin: JSON.stringify({ sub: "user-456" }),
			env: { JWT_KEY: JSON.stringify(pair) },
		});
		expect(run.code).toBe(0);
		let token = await JWT.verify(run.stdout.trim(), [keyPair]);
		expect(token.subject).toBe("user-456");
	});

	test("exits 2 when the environment variable is unset", async () => {
		let run = await jwt(["sign", "--key-env", "JWT_KEY"], { stdin: "{}" });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("$JWT_KEY is not set");
	});

	test("exits 2 when the claims are not an object", async () => {
		let keys = await file("pair.json", JSON.stringify(pair));
		let run = await jwt(["sign", "--key-file", keys], { stdin: "[1, 2]" });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("The claims must be a JSON object");
	});

	test("exits 2 when the key file is not a key pair", async () => {
		let keys = await file("pair.json", JSON.stringify({ privateKey: "nope" }));
		let run = await jwt(["sign", "--key-file", keys], { stdin: "{}" });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("pair.json is not a key pair from sdxc-jwt keygen");
	});

	test("exits 2 when no key is given", async () => {
		let run = await jwt(["sign"], { stdin: "{}" });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Pass exactly one of --key-file <path> or --key-env <name>");
	});
});

describe("keygen", () => {
	test("prints a key pair that signs and verifies", async () => {
		let run = await jwt(["keygen", "--alg", "Ed25519"]);
		expect(run.code).toBe(0);
		let generated = JSON.parse(run.stdout) as JWK.SerializedKeyPair;
		expect(generated.alg).toBe("Ed25519");
		let imported = await JWK.importKeyPair(generated);
		let token = await new JWT({ sub: "user-123" }).sign(JWK.Algorithm.Ed25519, [imported]);
		expect((await JWT.verify(token, [imported])).subject).toBe("user-123");
	});

	test("prints PEM", async () => {
		let run = await jwt(["keygen", "--format", "pem"]);
		expect(run.code).toBe(0);
		expect(run.stdout).toMatch(
			/^-----BEGIN PRIVATE KEY-----\n[\s\S]+-----END PRIVATE KEY-----\n-----BEGIN PUBLIC KEY-----\n[\s\S]+-----END PUBLIC KEY-----\n$/,
		);
	});

	test("exits 2 on an unsupported algorithm", async () => {
		let run = await jwt(["keygen", "--alg", "HS256"]);
		expect(run.code).toBe(2);
	});
});

describe("jwks", () => {
	test("prints only the public half of a key pair", async () => {
		let keys = await file("pair.json", JSON.stringify(pair));
		let run = await jwt(["jwks", "--key-file", keys]);
		expect(run.code).toBe(0);
		let set = JSON.parse(run.stdout) as JWK.PublishedKeySet;
		expect(set.keys).toHaveLength(1);
		expect(set.keys[0]?.kid).toBe(pair.id);
		expect(set.keys[0]).not.toHaveProperty("d");
	});
});
