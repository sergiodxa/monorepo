/**
 * Interoperability with GnuPG, run only where a `gpg` binary is installed: gpg verifies
 * what this package signs with gpg's own Ed25519, P-256 and RSA keys (exported in the
 * clear or passphrase-protected) and with keys generated here, and this package verifies
 * gpg's cleartext signatures. GnuPG 2.2 reads version 4 keys only.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { unwrap } from "@sdxc/result";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import {
	generateKey,
	readPrivateKey,
	readPublicKey,
	signCleartext,
	signDetached,
	verifyCleartext,
} from "./index.js";

/** Whether a usable `gpg` is on PATH. */
const HAS_GPG = spawnSync("gpg", ["--version"]).status === 0;

/** The text every test signs, with a dash-escaped line and trailing whitespace. */
const TEXT =
	"Contact: mailto:security@example.com  \n-----BEGIN fake-----\nExpires: 2027-01-01T00:00:00Z\n";

describe.skipIf(!HAS_GPG)("GnuPG interoperability", () => {
	let home = "";

	/**
	 * Runs gpg in the throwaway home and answers its exit status and output.
	 *
	 * @param args - gpg's arguments.
	 * @param input - What to write on standard input.
	 */
	let gpg = (args: string[], input?: string) => {
		let result = spawnSync(
			"gpg",
			["--homedir", home, "--batch", "--yes", "--pinentry-mode", "loopback", ...args],
			{
				input,
				encoding: "utf8",
			},
		);
		return { status: result.status, stdout: result.stdout, stderr: result.stderr };
	};

	/**
	 * Whether gpg verifies a signed file, a detached signature beside its data when given.
	 *
	 * @param signed - The cleartext message or detached signature.
	 * @param data - The signed data, for a detached signature.
	 */
	let gpgVerifies = (signed: string, data?: string) => {
		let signedPath = join(home, "signed.asc");
		writeFileSync(signedPath, signed);
		if (data === undefined) return gpg(["--verify", signedPath]);
		let dataPath = join(home, "data.txt");
		writeFileSync(dataPath, data);
		return gpg(["--verify", signedPath, dataPath]);
	};

	/**
	 * Generates a gpg key and answers its fingerprint.
	 *
	 * @param userId - The User ID.
	 * @param algorithm - gpg's algorithm name.
	 * @param passphrase - The passphrase, empty for none.
	 */
	let gpgKey = (userId: string, algorithm: string, passphrase = "") => {
		let created = gpg([
			"--passphrase",
			passphrase,
			"--quick-gen-key",
			userId,
			algorithm,
			"sign",
			"never",
		]);
		expect(created.status, created.stderr).toBe(0);
		let listed = gpg(["--with-colons", "--list-keys", userId]).stdout;
		return /^fpr:+([0-9A-F]+):/m.exec(listed)?.[1] ?? "";
	};

	beforeAll(() => {
		home = mkdtempSync("/tmp/sdxc-openpgp-");
	});

	afterAll(() => {
		spawnSync("gpgconf", ["--homedir", home, "--kill", "gpg-agent"]);
		rmSync(home, { recursive: true, force: true });
	});

	test("gpg verifies signatures made with gpg's own unprotected keys", async () => {
		for (let algorithm of ["ed25519", "nistp256", "rsa2048"]) {
			let userId = `Unprotected ${algorithm} <${algorithm}@example.com>`;
			let fingerprint = gpgKey(userId, algorithm);
			let exported = gpg([
				"--passphrase",
				"",
				"--armor",
				"--export-secret-keys",
				fingerprint,
			]).stdout;
			let key = unwrap(await readPrivateKey(exported));
			expect(key.fingerprint).toBe(fingerprint);

			let signed = unwrap(await signCleartext(TEXT, key));
			let verified = gpgVerifies(signed);
			expect(verified.status, verified.stderr).toBe(0);
			expect(verified.stderr).toContain(`Good signature from "${userId}"`);

			let detached = unwrap(await signDetached("payload\n", key));
			expect(gpgVerifies(detached.armored, "payload\n").status).toBe(0);
		}
	});

	test("unlocks a gpg key exported under a passphrase", async () => {
		let fingerprint = gpgKey("Protected <protected@example.com>", "ed25519", "hunter2");
		let exported = gpg([
			"--passphrase",
			"hunter2",
			"--armor",
			"--export-secret-keys",
			fingerprint,
		]).stdout;
		let locked = unwrap(await readPrivateKey(exported));
		expect(locked.locked).toBe(true);
		let wrong = await locked.unlock("hunter3");
		expect(wrong.status === "failure" && wrong.error.code).toBe("bad-passphrase");

		let key = unwrap(await locked.unlock("hunter2"));
		let verified = gpgVerifies(unwrap(await signCleartext(TEXT, key)));
		expect(verified.status, verified.stderr).toBe(0);
	});

	test("gpg imports and verifies a version 4 key generated here", async () => {
		let key = unwrap(
			await generateKey({ userId: "Generated <generated@example.com>", version: 4 }),
		);
		let imported = gpg(["--import"], key.publicKey.armor());
		expect(imported.status, imported.stderr).toBe(0);

		let verified = gpgVerifies(unwrap(await signCleartext(TEXT, key)));
		expect(verified.status, verified.stderr).toBe(0);
		expect(verified.stderr).toContain('Good signature from "Generated <generated@example.com>"');

		let text = unwrap(await signDetached("one\ntwo\n", key, { text: true }));
		expect(gpgVerifies(text.armored, "one\ntwo\n").status).toBe(0);
		let tampered = gpgVerifies(
			unwrap(await signCleartext(TEXT, key)).replace("security@", "attacker@"),
		);
		expect(tampered.status).not.toBe(0);
	});

	test("verifies gpg's cleartext signatures, which leave the final line break unsigned", async () => {
		let fingerprint = gpgKey("Signer <signer@example.com>", "ed25519");
		let signed = gpg(["--local-user", fingerprint, "--clearsign"], TEXT).stdout;
		let certificate = unwrap(await readPublicKey(gpg(["--armor", "--export", fingerprint]).stdout));
		let verified = unwrap(await verifyCleartext(signed, certificate));
		expect(verified.text).toBe(TEXT.replace("  \n", "\n").replace(/\n$/, ""));
		expect(verified.signature.primaryKey).toBe(fingerprint);
	});
});
