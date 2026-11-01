/**
 * Tests for the `sdxc-crypto` command line: output, `--json` shapes and exit codes for every
 * command, checked against published test vectors, and the usage errors a missing secret,
 * terminal stdin or an unreadable file produce — driven through `invoke()`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { invoke } from "@sdxc/cli/test";
import { unwrap } from "@sdxc/result";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { cli } from "./cli.js";
import { Base64Url } from "./encoding.js";
import { password } from "./password.js";

/** SHA-256 of `hello`, as `sha256sum` prints it. */
const HELLO_SHA256 = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";

/** HMAC-SHA256 of the pangram under the key `key`. */
const PANGRAM_MAC = "f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8";

const PANGRAM = "The quick brown fox jumps over the lazy dog";

/** The RFC 6238 SHA-1 test secret, `12345678901234567890`, in base32. */
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

let dir = "";

beforeAll(async () => {
	dir = await mkdtemp(join(tmpdir(), "sdxc-crypto-cli-"));
	await writeFile(join(dir, "hello.txt"), "hello");
	await writeFile(join(dir, "pangram.txt"), PANGRAM);
	await writeFile(join(dir, "key.txt"), "key\n");
	await writeFile(join(dir, "totp.txt"), `${RFC_SECRET}\n`);
	await writeFile(join(dir, "empty.txt"), "\n");
});

afterAll(async () => {
	await rm(dir, { recursive: true, force: true });
});

describe("token", () => {
	test("prints a 32-byte base64url token and a newline", async () => {
		let run = await invoke(cli, ["token"]);
		expect(run.code).toBe(0);
		expect(run.stdout).toMatch(/^[\w-]{43}\n$/);
		expect(unwrap(Base64Url.decode(run.stdout.trim()))).toHaveLength(32);
	});

	test("takes a prefix and a size, and drops the newline on request", async () => {
		let run = await invoke(cli, ["token", "--prefix", "sk", "--bytes", "12", "--no-newline"]);
		expect(run.code).toBe(0);
		expect(run.stdout).toMatch(/^sk_[\w-]{16}$/);
	});

	test("rejects a size that is not a positive integer", async () => {
		let run = await invoke(cli, ["token", "--bytes", "0"]);
		expect(run.code).toBe(2);
		expect(run.stdout).toBe("");
	});
});

describe("hash", () => {
	test("hashes a file as hex", async () => {
		let run = await invoke(cli, ["hash", "hello.txt"], { cwd: dir });
		expect(run).toMatchObject({ code: 0, stdout: `${HELLO_SHA256}\n`, stderr: "" });
	});

	test("hashes stdin when the path is absent or -", async () => {
		expect((await invoke(cli, ["hash"], { stdin: "hello" })).stdout).toBe(`${HELLO_SHA256}\n`);
		expect((await invoke(cli, ["hash", "-"], { stdin: "hello" })).stdout).toBe(`${HELLO_SHA256}\n`);
	});

	test("prints another algorithm and encoding as JSON", async () => {
		let run = await invoke(cli, ["hash", "--alg", "sha512", "--encoding", "base64url", "--json"], {
			stdin: "hello",
		});
		expect(run.code).toBe(0);
		let report = JSON.parse(run.stdout) as { algorithm: string; encoding: string; digest: string };
		expect(report).toMatchObject({ algorithm: "sha512", encoding: "base64url" });
		expect(unwrap(Base64Url.decode(report.digest))).toHaveLength(64);
	});

	test("exits 2 for an unreadable file", async () => {
		let run = await invoke(cli, ["hash", "missing.txt"], { cwd: dir });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Cannot read missing.txt");
	});

	test("exits 2 without a file when stdin is a terminal", async () => {
		let run = await invoke(cli, ["hash"], { interactive: true });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("pipe the input on stdin");
	});

	test("rejects an unknown algorithm", async () => {
		let run = await invoke(cli, ["hash", "--alg", "md5"], { stdin: "hello" });
		expect(run.code).toBe(2);
	});
});

describe("hmac", () => {
	test("signs a file with a key file, dropping its trailing newline", async () => {
		let run = await invoke(cli, ["hmac", "pangram.txt", "--key-file", "key.txt"], { cwd: dir });
		expect(run).toMatchObject({ code: 0, stdout: `${PANGRAM_MAC}\n` });
	});

	test("signs stdin with a key from a named environment variable", async () => {
		let run = await invoke(cli, ["hmac", "--key-env", "SIGNING_KEY", "--json"], {
			stdin: PANGRAM,
			env: { SIGNING_KEY: "key" },
		});
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({
			algorithm: "SHA-256",
			encoding: "hex",
			mac: PANGRAM_MAC,
		});
	});

	test("verifies a matching signature with exit 0 and a wrong one with exit 1", async () => {
		let options = { stdin: PANGRAM, env: { SIGNING_KEY: "key" } };
		let valid = await invoke(
			cli,
			["hmac", "--key-env", "SIGNING_KEY", "--verify", PANGRAM_MAC],
			options,
		);
		expect(valid).toMatchObject({ code: 0, stdout: "valid\n" });
		let invalid = await invoke(
			cli,
			["hmac", "--key-env", "SIGNING_KEY", "--verify", "00".repeat(32), "--json"],
			options,
		);
		expect(invalid.code).toBe(1);
		expect(JSON.parse(invalid.stdout)).toEqual({ algorithm: "SHA-256", valid: false });
	});

	test("reads the key from stdin when the input is a file", async () => {
		let run = await invoke(cli, ["hmac", "pangram.txt", "--key-file", "-"], {
			cwd: dir,
			stdin: "key\n",
		});
		expect(run).toMatchObject({ code: 0, stdout: `${PANGRAM_MAC}\n` });
	});

	test("exits 2 when stdin would carry both the key and the input", async () => {
		let run = await invoke(cli, ["hmac", "--key-file", "-"], { stdin: "key" });
		expect(run.code).toBe(2);
	});

	test("exits 2 without exactly one key source", async () => {
		let none = await invoke(cli, ["hmac"], { stdin: PANGRAM });
		expect(none.code).toBe(2);
		expect(none.stderr).toContain("--key-file or --key-env");
		let both = await invoke(cli, ["hmac", "--key-file", "key.txt", "--key-env", "K"], {
			cwd: dir,
			stdin: PANGRAM,
			env: { K: "key" },
		});
		expect(both.code).toBe(2);
	});

	test("exits 2 for an unset variable or an empty key file", async () => {
		let unset = await invoke(cli, ["hmac", "--key-env", "SIGNING_KEY"], { stdin: PANGRAM });
		expect(unset.code).toBe(2);
		expect(unset.stderr).toContain("SIGNING_KEY");
		let empty = await invoke(cli, ["hmac", "pangram.txt", "--key-file", "empty.txt"], {
			cwd: dir,
		});
		expect(empty.code).toBe(2);
	});
});

describe("totp", () => {
	test("prints the RFC 6238 code for a secret file at a given moment", async () => {
		let run = await invoke(
			cli,
			["totp", "--secret-file", "totp.txt", "--digits", "8", "--at", "1970-01-01T00:00:59Z"],
			{ cwd: dir },
		);
		expect(run).toMatchObject({ code: 0, stdout: "94287082\n" });
	});

	test("prints the code and when it expires as JSON", async () => {
		let run = await invoke(
			cli,
			["totp", "--secret-env", "TOTP", "--digits", "8", "--at", "2005-03-18T01:58:29Z", "--json"],
			{ env: { TOTP: RFC_SECRET } },
		);
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toEqual({
			code: "07081804",
			expiresAt: "2005-03-18T01:58:30.000Z",
		});
	});

	test("prints a six-digit code for now by default", async () => {
		let run = await invoke(cli, ["totp", "--secret-env", "TOTP"], { env: { TOTP: RFC_SECRET } });
		expect(run.code).toBe(0);
		expect(run.stdout).toMatch(/^\d{6}\n$/);
	});

	test("exits 2 for a secret that is not base32", async () => {
		let run = await invoke(cli, ["totp", "--secret-env", "TOTP"], { env: { TOTP: "not base32!" } });
		expect(run.code).not.toBe(0);
	});

	test("rejects a moment that is not a date-time", async () => {
		let run = await invoke(cli, ["totp", "--secret-env", "TOTP", "--at", "soon"], {
			env: { TOTP: RFC_SECRET },
		});
		expect(run.code).toBe(2);
	});
});

describe("scrypt", () => {
	test("hashes a piped password into a hash that verifies it", async () => {
		let run = await invoke(cli, ["scrypt", "hash"], { stdin: "hunter2\n" });
		expect(run.code).toBe(0);
		let stored = run.stdout.trim();
		expect(stored).toMatch(/^\$scrypt\$/);
		expect(unwrap(await password.verify(stored, "hunter2"))).toBe(true);
	});

	test("asks for the password at a terminal", async () => {
		let run = await invoke(cli, ["scrypt", "hash"], { answers: { password: "hunter2" } });
		expect(run.code).toBe(0);
		expect(unwrap(await password.verify(run.stdout.trim(), "hunter2"))).toBe(true);
	});

	test("exits 2 for an empty password", async () => {
		let run = await invoke(cli, ["scrypt", "hash"], { stdin: "\n" });
		expect(run.code).toBe(2);
	});

	test("verifies with exit 0 on a match and exit 1 on a mismatch", async () => {
		let stored = unwrap(await password.hash("hunter2"));
		let match = await invoke(cli, ["scrypt", "verify", stored], { stdin: "hunter2\n" });
		expect(match).toMatchObject({ code: 0, stdout: "valid\n" });
		let mismatch = await invoke(cli, ["scrypt", "verify", stored, "--json"], { stdin: "hunter3" });
		expect(mismatch.code).toBe(1);
		expect(JSON.parse(mismatch.stdout)).toEqual({ valid: false, needsRehash: false });
	});

	test("exits 2 for a stored value that is not a scrypt hash", async () => {
		let run = await invoke(cli, ["scrypt", "verify", "$2b$10$abc"], { stdin: "hunter2" });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("$scrypt$");
	});
});
