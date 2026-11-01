/**
 * The `sdxc-openpgp` command line as a contract: `sign`, `verify`, `inspect` and `keygen`,
 * with their arguments and flags. Help, usage errors and every handler's typed `ctx.flags`
 * come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** A file to read, or `-` (the default) to read stdin. */
const FILE = argument(s.string(), {
	default: "-",
	valueName: "file",
	description: "The file to read, or - for stdin",
});

/**
 * Where a private key's passphrase comes from: a file or a named environment variable, so
 * it stays out of shell history and process listings.
 */
const PASSPHRASE_SOURCE = {
	passphraseFile: flag.string("passphrase-file", {
		valueName: "path",
		description:
			"Read the passphrase from this file (- for stdin); one trailing newline is dropped",
		heading: "Passphrase",
	}),
	passphraseEnv: flag.string("passphrase-env", {
		valueName: "name",
		description: "Read the passphrase from this environment variable",
		heading: "Passphrase",
	}),
};

/** `--json`, for every command that prints a report. */
const JSON_FLAG = flag.boolean("json", { description: "Print the report as JSON" });

/** Every command `sdxc-openpgp` takes. */
export const OPENPGP_COMMANDS = commands({
	description: "sdxc-openpgp — sign and verify with OpenPGP keys, inspect them and generate them",
	sign: command({
		description:
			"Sign a file as a cleartext signed message, or with --detach print an armored detached signature",
		arguments: { file: FILE },
		flags: {
			keyFile: flag.string("key-file", {
				valueName: "path",
				description: "Read the armored private key from this file (- for stdin)",
				heading: "Key",
			}),
			keyEnv: flag.string("key-env", {
				valueName: "name",
				description: "Read the armored private key from this environment variable",
				heading: "Key",
			}),
			...PASSPHRASE_SOURCE,
			detach: flag.boolean("detach", {
				description: "Print a detached signature instead of the signed text",
			}),
			text: flag.boolean("text", {
				description: "Make the detached signature a text signature, which ignores line endings",
			}),
			hash: flag.string("hash", {
				default: "SHA-512",
				schema: s.enum_(["SHA-256", "SHA-384", "SHA-512"]),
				description: "Hash to sign with: SHA-256, SHA-384 or SHA-512",
			}),
		},
		examples: [
			"sign security.txt --key-file private.asc > security.txt.signed",
			"sign release.tar.gz --detach --key-env PGP_KEY --passphrase-env PGP_PASSPHRASE > release.tar.gz.asc",
		],
	}),
	verify: command({
		description:
			"Verify a cleartext signed message, or a file against --signature; exits 1 when the signature is bad or made by another key",
		arguments: { file: FILE },
		flags: {
			keyFile: flag.string("key-file", {
				required: true,
				valueName: "path",
				description: "The armored public key to accept signatures from (- for stdin)",
			}),
			signature: flag.string("signature", {
				valueName: "path",
				description: "A detached signature, armored or binary (- for stdin)",
			}),
			json: JSON_FLAG,
		},
		examples: [
			"verify security.txt --key-file public.asc",
			"verify release.tar.gz --signature release.tar.gz.asc --key-file public.asc --json",
		],
	}),
	inspect: command({
		description:
			"Print a key's fingerprint, User IDs, algorithms, expiry and subkeys, checking its self-signatures",
		arguments: {
			key: argument(s.string(), {
				default: "-",
				valueName: "key",
				description: "An armored or binary public or private key, or - for stdin",
			}),
		},
		flags: { json: JSON_FLAG },
		examples: ["inspect public.asc", "inspect private.asc --json"],
	}),
	keygen: command({
		description: "Generate an Ed25519 signing key and print it as an armored private key block",
		flags: {
			userId: flag.string("user-id", {
				valueName: "id",
				description: "The User ID to certify, such as 'Security <security@example.com>'",
			}),
			keyVersion: flag.string("key-version", {
				default: "6",
				schema: s.enum_(["4", "6"]),
				description: "6 (RFC 9580) or 4, which GnuPG 2.2 and other RFC 4880 tools read",
			}),
			publicOut: flag.string("public-out", {
				valueName: "path",
				description: "Also write the armored public key to this file",
			}),
			...PASSPHRASE_SOURCE,
		},
		examples: [
			"keygen --user-id 'Security <security@example.com>' --public-out public.asc > private.asc",
			"keygen --key-version 4 --passphrase-env PGP_PASSPHRASE > private.asc",
		],
	}),
});
