/**
 * Tests for the `sdxc-openpgp` command line: each command's output, its `--json` report and
 * its exit code, driven through `invoke()` against keys written into a temporary directory,
 * so signing, verifying and inspecting run on the same files a person would pass.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { InvokeOptions } from "@sdxc/cli/test";

import { invoke } from "@sdxc/cli/test";
import { unwrap } from "@sdxc/result";
import { afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";

import type { PrivateKey } from "./keys.js";

import { cli } from "./cli.js";
import { generateKey } from "./keys.js";

/** The User ID the test key certifies. */
const USER_ID = "Security <security@sdxc.dev>";

let dir = "";
let key: PrivateKey;
let other: PrivateKey;

beforeAll(async () => {
	key = unwrap(await generateKey({ userId: USER_ID }));
	other = unwrap(await generateKey({ userId: "Someone Else <else@sdxc.dev>" }));
});

beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "sdxc-openpgp-"));
	await file("private.asc", key.armor());
	await file("public.asc", key.publicKey.armor());
	await file("other.asc", other.publicKey.armor());
});

afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

/** Runs `sdxc-openpgp` in the test's directory with no environment but what `options` gives. */
function openpgp(argv: string[], options: InvokeOptions = {}) {
	return invoke(cli, argv, { cwd: dir, env: {}, ...options });
}

/** Writes `content` into the test's directory and answers its name. */
async function file(name: string, content: string | Uint8Array): Promise<string> {
	await writeFile(join(dir, name), content);
	return name;
}

describe("sign and verify a cleartext message", () => {
	test("signs a file and verifies the result", async () => {
		await file("security.txt", "Contact: mailto:security@sdxc.dev\n");
		let signed = await openpgp(["sign", "security.txt", "--key-file", "private.asc"]);
		expect(signed.code).toBe(0);
		expect(signed.stdout).toMatch(/^-----BEGIN PGP SIGNED MESSAGE-----\n/);
		expect(signed.stdout).toContain("Contact: mailto:security@sdxc.dev");
		expect(signed.stderr).toBe("");

		await file("security.txt.signed", signed.stdout);
		let run = await openpgp(["verify", "security.txt.signed", "--key-file", "public.asc"]);
		expect(run.code).toBe(0);
		expect(run.stdout).toContain(`Good signature from ${USER_ID}`);
		expect(run.stdout).toContain(`Primary key  ${key.fingerprint}`);
		expect(run.stderr).toBe("");
	});

	test("reads the message from stdin and the key from an environment variable", async () => {
		let signed = await openpgp(["sign", "--key-env", "PGP_KEY"], {
			stdin: "hello\n",
			env: { PGP_KEY: key.armor() },
		});
		expect(signed.code).toBe(0);
		let run = await openpgp(["verify", "--key-file", "public.asc", "--json"], {
			stdin: signed.stdout,
		});
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toMatchObject({
			valid: true,
			signingKey: key.fingerprint,
			primaryKey: key.fingerprint,
			userIds: [USER_ID],
			hash: "SHA-512",
			text: true,
		});
	});

	test("exits 1 on a tampered message, naming the signer", async () => {
		let signed = await openpgp(["sign", "--key-file", "private.asc"], { stdin: "pay 10\n" });
		await file("tampered.txt", signed.stdout.replace("pay 10", "pay 99"));
		let run = await openpgp(["verify", "tampered.txt", "--key-file", "public.asc"]);
		expect(run.code).toBe(1);
		expect(run.stdout).toBe("");
		expect(run.stderr).toContain("Bad signature:");
		expect(run.stderr).toContain(`Issuer fingerprint  ${key.fingerprint}`);
		expect(run.stderr).toContain(`Issuer key ID       ${key.keyId}`);
	});

	test("exits 1 on a signature by another key, reporting its issuer as JSON", async () => {
		let signed = await openpgp(["sign", "--key-file", "private.asc"], { stdin: "hello\n" });
		await file("signed.txt", signed.stdout);
		let run = await openpgp(["verify", "signed.txt", "--key-file", "other.asc", "--json"]);
		expect(run.code).toBe(1);
		expect(JSON.parse(run.stdout)).toEqual({
			valid: false,
			code: "unknown-signer",
			error: "None of the given keys made the signature.",
			issuers: [{ keyId: key.keyId, fingerprint: key.fingerprint }],
		});
	});

	test("exits 1 on a file that carries no signature", async () => {
		await file("plain.txt", "hello\n");
		let run = await openpgp(["verify", "plain.txt", "--key-file", "public.asc"]);
		expect(run.code).toBe(1);
		expect(run.stderr).toContain("No signature:");
	});
});

describe("sign and verify a detached signature", () => {
	test("signs a binary file byte for byte", async () => {
		let bytes = Uint8Array.of(0, 255, 13, 10, 128, 7);
		await file("release.bin", bytes);
		let signed = await openpgp(["sign", "release.bin", "--detach", "--key-file", "private.asc"]);
		expect(signed.code).toBe(0);
		expect(signed.stdout).toMatch(/^-----BEGIN PGP SIGNATURE-----\n/);

		await file("release.bin.asc", signed.stdout);
		let flags = ["--signature", "release.bin.asc", "--key-file", "public.asc"];
		let run = await openpgp(["verify", "release.bin", ...flags]);
		expect(run.code).toBe(0);
		expect(run.stdout).toContain("Good signature");

		await file("release.bin", Uint8Array.of(0, 255, 13, 10, 128, 8));
		let tampered = await openpgp(["verify", "release.bin", ...flags]);
		expect(tampered.code).toBe(1);
		expect(tampered.stderr).toContain(`Issuer fingerprint  ${key.fingerprint}`);
	});

	test("makes a text signature with the hash asked for", async () => {
		await file("notes.txt", "one\ntwo\n");
		let signed = await openpgp([
			"sign",
			"notes.txt",
			"--detach",
			"--text",
			"--hash",
			"SHA-256",
			"--key-file",
			"private.asc",
		]);
		await file("notes.txt.asc", signed.stdout);
		await file("notes.txt", "one\r\ntwo\r\n");
		let run = await openpgp([
			"verify",
			"notes.txt",
			"--signature",
			"notes.txt.asc",
			"--key-file",
			"public.asc",
			"--json",
		]);
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toMatchObject({ valid: true, hash: "SHA-256", text: true });
	});
});

describe("passphrase-protected keys", () => {
	test("signs once the passphrase comes from a file", async () => {
		await file("locked.asc", unwrap(await key.lock("correct horse")).armor());
		await file("passphrase.txt", "correct horse\n");
		let locked = await openpgp(["sign", "--key-file", "locked.asc"], { stdin: "hi\n" });
		expect(locked.code).toBe(2);
		expect(locked.stderr).toContain("passphrase-protected; pass --passphrase-file");

		let run = await openpgp(
			["sign", "--key-file", "locked.asc", "--passphrase-file", "passphrase.txt"],
			{ stdin: "hi\n" },
		);
		expect(run.code).toBe(0);
		expect(run.stdout).toContain("-----BEGIN PGP SIGNATURE-----");
	});

	test("exits 2 on a wrong passphrase", async () => {
		await file("locked.asc", unwrap(await key.lock("correct horse")).armor());
		let run = await openpgp(
			["sign", "--key-file", "locked.asc", "--passphrase-env", "PASSPHRASE"],
			{ stdin: "hi\n", env: { PASSPHRASE: "wrong" } },
		);
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Cannot read the key in locked.asc");
	});
});

describe("usage and unreadable input", () => {
	test("exits 2 without a key", async () => {
		let run = await openpgp(["sign"], { stdin: "hi\n" });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Pass --key-file <path> or --key-env <name>");
	});

	test("exits 2 on --text without --detach", async () => {
		let run = await openpgp(["sign", "--text", "--key-file", "private.asc"], { stdin: "hi\n" });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("--text applies only with --detach");
	});

	test("exits 2 when two inputs both ask for stdin", async () => {
		let run = await openpgp(["sign", "-", "--key-file", "-"], { stdin: "hi\n" });
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Only one input can come from stdin");
	});

	test("exits 2 on a file that does not exist", async () => {
		let run = await openpgp(["verify", "missing.txt", "--key-file", "public.asc"]);
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Cannot read missing.txt");
	});

	test("exits 2 on a key file that holds no key", async () => {
		await file("junk.asc", "not a key");
		let run = await openpgp(["inspect", "junk.asc"]);
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("Cannot read the key in junk.asc");
	});
});

describe("inspect", () => {
	test("prints a certificate's identity, User IDs and status", async () => {
		let run = await openpgp(["inspect", "public.asc"]);
		expect(run.code).toBe(0);
		expect(run.stdout).toContain(`Fingerprint  ${key.fingerprint}`);
		expect(run.stdout).toContain(`Key ID       ${key.keyId}`);
		expect(run.stdout).toContain("Algorithm    Ed25519");
		expect(run.stdout).toContain("Expires      never");
		expect(run.stdout).toContain("Status       valid");
		expect(run.stdout).toContain(`User IDs\n  ${USER_ID}\n`);
		expect(run.stdout).not.toContain("Secret");
	});

	test("reports a private key from stdin as JSON", async () => {
		let run = await openpgp(["inspect", "--json"], { stdin: key.armor() });
		expect(run.code).toBe(0);
		expect(JSON.parse(run.stdout)).toMatchObject({
			fingerprint: key.fingerprint,
			keyId: key.keyId,
			version: 6,
			algorithm: "Ed25519",
			expires: null,
			revoked: false,
			canSign: true,
			secret: true,
			locked: false,
			userIds: [{ userId: USER_ID, certified: true }],
			subkeys: [],
		});
	});
});

describe("keygen", () => {
	test("prints a private key and writes its certificate", async () => {
		let run = await openpgp(["keygen", "--user-id", USER_ID, "--public-out", "new.asc"]);
		expect(run.code).toBe(0);
		expect(run.stdout).toMatch(/^-----BEGIN PGP PRIVATE KEY BLOCK-----\n/);
		expect(run.stderr).toMatch(/^Generated key [0-9A-F]{64}\n$/);

		let certificate = await readFile(join(dir, "new.asc"), "utf8");
		expect(certificate).toMatch(/^-----BEGIN PGP PUBLIC KEY BLOCK-----\n/);
		await file("new-private.asc", run.stdout);
		let signed = await openpgp(["sign", "--key-file", "new-private.asc"], { stdin: "hi\n" });
		await file("signed.txt", signed.stdout);
		let verified = await openpgp(["verify", "signed.txt", "--key-file", "new.asc"]);
		expect(verified.code).toBe(0);
	});

	test("generates a version 4 key locked with a passphrase", async () => {
		let run = await openpgp(["keygen", "--key-version", "4", "--passphrase-env", "PASSPHRASE"], {
			env: { PASSPHRASE: "correct horse" },
		});
		expect(run.code).toBe(0);
		expect(run.stderr).toMatch(/^Generated key [0-9A-F]{40}\n$/);
		let inspected = await openpgp(["inspect", "--json"], { stdin: run.stdout });
		expect(JSON.parse(inspected.stdout)).toMatchObject({
			version: 4,
			algorithm: "Ed25519Legacy",
			secret: true,
			locked: true,
		});
	});

	test("exits 2 when the passphrase variable is unset", async () => {
		let run = await openpgp(["keygen", "--passphrase-env", "PASSPHRASE"]);
		expect(run.code).toBe(2);
		expect(run.stderr).toContain("$PASSPHRASE is not set");
	});
});
