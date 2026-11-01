/**
 * The `sdxc-jwt` command line as a contract: `decode`, `verify`, `sign`, `keygen` and `jwks`,
 * with their arguments and flags. Help, usage errors and every handler's typed `ctx.flags`
 * come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

import * as Algorithm from "./algorithm.js";

/** Every algorithm a key can be generated for or a token verified under. */
const ALGORITHMS = [Algorithm.ES256, Algorithm.RS256, Algorithm.Ed25519] as const;

/** A token given on the command line, or `-` (the default) to read it from stdin. */
const TOKEN = argument(s.string(), {
	default: "-",
	valueName: "token",
	description: "The compact token, or - to read it from stdin",
});

/**
 * Where a key pair from `sdxc-jwt keygen` comes from: a file or a named environment
 * variable, so the private key stays out of shell history and process listings.
 */
const KEY_SOURCE = {
	keyFile: flag.string("key-file", {
		valueName: "path",
		description: "Read the key pair from this file (- for stdin)",
		heading: "Key",
	}),
	keyEnv: flag.string("key-env", {
		valueName: "name",
		description: "Read the key pair from this environment variable",
		heading: "Key",
	}),
};

/** `--json`, for every command that prints a report. */
const JSON_FLAG = flag.boolean("json", { description: "Print the report as JSON" });

/** Every command `sdxc-jwt` takes. */
export const JWT_COMMANDS = commands({
	description: "sdxc-jwt — decode, verify and sign JSON Web Tokens, and generate their keys",
	decode: command({
		description: "Print a token's header and claims without verifying it",
		arguments: { token: TOKEN },
		flags: { json: JSON_FLAG },
		examples: ["decode eyJhbGciOi…", "decode < token.txt --json"],
	}),
	verify: command({
		description:
			"Check a token's signature, expiry and any expected issuer or audience; exits 1 when it is invalid",
		arguments: { token: TOKEN },
		flags: {
			jwks: flag.string("jwks", {
				valueName: "url",
				description: "Verify against the key set served at this URL",
				heading: "Keys",
			}),
			keyFile: flag.string("key-file", {
				valueName: "path",
				description: "Verify against a JWKS, a public JWK or a key pair from keygen",
				heading: "Keys",
			}),
			iss: flag.string("iss", { valueName: "issuer", description: "Require this issuer" }),
			aud: flag.string("aud", { valueName: "audience", description: "Require this audience" }),
			alg: flag
				.string("alg", {
					schema: s.enum_(ALGORITHMS),
					description: "Accept only this algorithm (repeatable; default: every supported one)",
				})
				.multiple(),
			json: JSON_FLAG,
		},
		examples: [
			"verify $TOKEN --jwks https://auth.example.com/.well-known/jwks.json --iss https://auth.example.com",
			"verify --key-file jwks.json --aud api < token.txt --json",
		],
	}),
	sign: command({
		description: "Sign a JSON object of claims; exp, iat and nbf may be durations such as 1h",
		arguments: {
			claims: argument(s.string(), {
				default: "-",
				valueName: "claims.json",
				description: "A JSON file of claims, or - to read them from stdin",
			}),
		},
		flags: KEY_SOURCE,
		examples: [
			"sign claims.json --key-file key.json",
			`echo '{"sub":"user-123","exp":"15m"}' | sign --key-env JWT_KEY`,
		],
	}),
	keygen: command({
		description:
			"Generate a signing key pair, as the JSON sign and verify read or as PEM for other tools",
		flags: {
			alg: flag.string("alg", {
				default: Algorithm.ES256,
				schema: s.enum_(ALGORITHMS),
				description: `Algorithm to generate for: ${ALGORITHMS.join(", ")}`,
			}),
			format: flag.string("format", {
				default: "pair",
				schema: s.enum_(["pair", "pem"]),
				description: "pair (JSON with id, alg and both PEMs) or pem (private then public key)",
			}),
		},
		examples: ["keygen > key.json", "keygen --alg Ed25519 --format pem"],
	}),
	jwks: command({
		description:
			"Print the public key set for a key pair, ready to serve as /.well-known/jwks.json",
		flags: KEY_SOURCE,
		examples: ["jwks --key-file key.json > jwks.json"],
	}),
});
