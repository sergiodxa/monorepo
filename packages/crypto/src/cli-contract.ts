/**
 * The `sdxc-crypto` command line as a contract: `token`, `hash`, `hmac`, `totp` and the
 * `scrypt hash` / `scrypt verify` pair. Help, usage errors and each handler's typed `ctx.flags`
 * come from this one declaration; secrets are only ever named here by file or variable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "remix/data-schema";

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/**
 * A decimal integer from `min` to `max`, written as digits only, so `+8`, `8.0` and `0x8` are
 * usage errors.
 *
 * @param min - The smallest accepted value
 * @param max - The largest accepted value
 */
function integer(min: number, max: number): Schema<unknown, number> {
	return s.createSchema(function validate(value, context) {
		if (typeof value === "string" && /^\d+$/.test(value)) {
			let parsed = Number(value);
			if (parsed >= min && parsed <= max) return { value: parsed };
		}
		return s.fail(
			`expects an integer from ${min} to ${max}; got ${JSON.stringify(value)}`,
			context.path,
		);
	});
}

/** A moment as an ISO 8601 date-time, read into epoch milliseconds. */
function instant(): Schema<unknown, number> {
	return s.createSchema(function validate(value, context) {
		let time = typeof value === "string" ? Date.parse(value) : Number.NaN;
		if (!Number.isNaN(time)) return { value: time };
		return s.fail(`expects an ISO 8601 date-time; got ${JSON.stringify(value)}`, context.path);
	});
}

/** The text encodings a digest or MAC prints in, hex first as `sha256sum` prints it. */
const ENCODINGS = ["hex", "base64", "base64url"] as const;

/** The input every byte-reading command takes: a path, or stdin when it is `-` or absent. */
const INPUT = argument(s.string(), {
	optional: true,
	description: "The file to read; stdin when it is - or absent",
});

/** The flag choosing how a digest or MAC prints. */
const ENCODING = flag.string("encoding", {
	valueName: "hex|base64|base64url",
	default: "hex",
	schema: s.enum_(ENCODINGS),
	description: "How the bytes print",
});

/** The flag printing a command's result as one JSON object. */
const JSON_OUTPUT = flag.boolean("json", { description: "Print the result as JSON" });

/** Every command `sdxc-crypto` takes. */
export const CRYPTO_COMMANDS = commands({
	description: "sdxc-crypto — tokens, digests, MACs, one-time codes and password hashes",
	token: command({
		description:
			"Print a random base64url secret, ready to pipe into a secret store such as `cf workers secrets update`.",
		flags: {
			bytes: flag.string("bytes", {
				valueName: "N",
				default: 32,
				schema: integer(1, 65536),
				description: "Bytes of entropy",
			}),
			prefix: flag.string("prefix", {
				description: "A label joined with _, so a leaked token is recognizable (sk → sk_…)",
			}),
			newline: flag.boolean("newline", {
				default: true,
				description: "End the token with a newline; --no-newline prints the token alone",
			}),
		},
		examples: [
			"token",
			"token --prefix sk --bytes 24",
			"token --no-newline | cf workers secrets update API_KEY",
		],
	}),
	hash: command({
		description: "Print the digest of a file or of stdin, read as UTF-8 text.",
		arguments: { input: INPUT },
		flags: {
			alg: flag.string("alg", {
				valueName: "sha256|sha384|sha512",
				default: "sha256",
				schema: s.enum_(["sha256", "sha384", "sha512"] as const),
				description: "The digest algorithm",
			}),
			encoding: ENCODING,
			json: JSON_OUTPUT,
		},
		examples: ["hash release.tar.gz", "echo -n hello | hash --alg sha512 --encoding base64url"],
	}),
	hmac: command({
		description:
			"Print the HMAC of a file or of stdin under a key read from a file or an environment variable; with --verify, check a signature instead and exit 1 on a mismatch.",
		arguments: { input: INPUT },
		flags: {
			keyFile: flag.string("key-file", {
				valueName: "path",
				description: "Read the key from this file (- for stdin); one trailing newline is dropped",
				heading: "Key",
			}),
			keyEnv: flag.string("key-env", {
				valueName: "NAME",
				description: "Read the key from this environment variable",
				heading: "Key",
			}),
			alg: flag.string("alg", {
				valueName: "SHA-1|SHA-256|SHA-384|SHA-512",
				default: "SHA-256",
				schema: s.enum_(["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const),
				description: "The hash under the MAC",
			}),
			verify: flag.string("verify", {
				valueName: "hex",
				description: "A hex signature to check against the input",
			}),
			encoding: ENCODING,
			json: JSON_OUTPUT,
		},
		examples: [
			"hmac body.json --key-env WEBHOOK_SECRET",
			"hmac body.json --key-file secret.txt --verify 5d41402abc4b2a76…",
		],
	}),
	totp: command({
		description:
			"Print the current one-time code for a base32 secret read from a file or an environment variable.",
		flags: {
			secretFile: flag.string("secret-file", {
				valueName: "path",
				description:
					"Read the secret from this file (- for stdin); one trailing newline is dropped",
				heading: "Secret",
			}),
			secretEnv: flag.string("secret-env", {
				valueName: "NAME",
				description: "Read the secret from this environment variable",
				heading: "Secret",
			}),
			digits: flag.string("digits", {
				valueName: "N",
				default: 6,
				schema: integer(1, 10),
				description: "Digits in the code",
			}),
			step: flag.string("step", {
				valueName: "seconds",
				default: 30,
				schema: integer(1, 86400),
				description: "How long one code lasts",
			}),
			algorithm: flag.string("algorithm", {
				valueName: "SHA-1|SHA-256|SHA-512",
				default: "SHA-1",
				schema: s.enum_(["SHA-1", "SHA-256", "SHA-512"] as const),
				description: "The hash under the code",
			}),
			at: flag.string("at", {
				valueName: "date-time",
				schema: instant(),
				description: "The moment to compute the code for (default: now)",
			}),
			json: JSON_OUTPUT,
		},
		examples: ["totp --secret-env TOTP_SECRET", "totp --secret-file totp.txt --digits 8 --json"],
	}),
	scrypt: commands({
		description: "Hash and verify passwords with scrypt",
		hash: command({
			description:
				"Hash a password piped on stdin (or typed at a terminal) into a self-describing $scrypt$ string.",
			examples: ["scrypt hash < password.txt"],
		}),
		verify: command({
			description:
				"Check a password piped on stdin (or typed at a terminal) against a stored hash; exit 1 on a mismatch.",
			arguments: {
				stored: argument(s.string(), { description: "The stored $scrypt$ hash, in single quotes" }),
			},
			flags: { json: JSON_OUTPUT },
			examples: ["scrypt verify '$scrypt$ln=15,r=8,p=3$…$…' < password.txt"],
		}),
	}),
});
