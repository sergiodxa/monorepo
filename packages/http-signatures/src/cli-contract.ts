/**
 * The `sdxc-http-signatures` command line as a contract: `sign` and `verify`, with their
 * arguments and flags. Help, usage errors and every handler's typed `ctx.flags` come from
 * this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** Every algorithm a key can be imported for. */
export const ALGORITHMS = [
	"ed25519",
	"ecdsa-p256-sha256",
	"rsa-v1_5-sha256",
	"rsa-pss-sha512",
] as const;

/**
 * `--key-file` and `--key-env`, so a private key stays out of shell history and process
 * listings, plus `--alg` for an RSA key whose type leaves the algorithm open.
 */
const KEY_FLAGS = {
	keyFile: flag.string("key-file", {
		valueName: "path",
		description: "Read the key (PEM or JWK; a JWKS to verify) from this file (- for stdin)",
		heading: "Key",
	}),
	keyEnv: flag.string("key-env", {
		valueName: "name",
		description: "Read the key from this environment variable",
		heading: "Key",
	}),
	alg: flag.string("alg", {
		schema: s.enum_(ALGORITHMS),
		description:
			"Import the key for this algorithm (default: the key's type decides, RSA reads as rsa-v1_5-sha256)",
		heading: "Key",
	}),
};

/** `--json`, for every command that prints a report. */
const JSON_FLAG = flag.boolean("json", { description: "Print the report as JSON" });

/** Every command `sdxc-http-signatures` takes. */
export const HTTP_SIGNATURES_COMMANDS = commands({
	description:
		"sdxc-http-signatures — sign and verify HTTP requests with RFC 9421 or draft-cavage-12",
	sign: command({
		description:
			"Sign a request and print the headers a verifier needs, or a curl command that sends it",
		arguments: {
			method: argument(s.string(), { valueName: "method", description: "The request method" }),
			url: argument(s.string(), { valueName: "url", description: "The absolute request URL" }),
		},
		flags: {
			...KEY_FLAGS,
			keyId: flag.string("key-id", {
				required: true,
				valueName: "id",
				description: "The keyid (RFC 9421) or keyId (cavage) the verifier looks the key up by",
				heading: "Key",
			}),
			scheme: flag.string("scheme", {
				default: "rfc9421",
				schema: s.enum_(["rfc9421", "draft-cavage"]),
				description: "rfc9421 (Signature-Input and Signature) or draft-cavage (one Signature)",
			}),
			header: flag
				.string("header", {
					short: "H",
					valueName: "name:value",
					description: "Add a request header",
				})
				.multiple(),
			bodyFile: flag.string("body-file", {
				valueName: "path",
				description: "Send and cover this file as the body (- for stdin)",
			}),
			components: flag
				.string("components", {
					valueName: "list",
					description:
						'What to cover, separated by spaces or commas, such as "@method @target-uri date" or (request-target) for cavage',
				})
				.multiple(),
			label: flag.string("label", {
				valueName: "label",
				description: "The RFC 9421 signature label (default: sig1)",
			}),
			tag: flag.string("tag", { valueName: "tag", description: "The RFC 9421 tag parameter" }),
			nonce: flag.string("nonce", {
				valueName: "nonce",
				description: "The RFC 9421 nonce parameter",
			}),
			curl: flag.boolean("curl", {
				description: "Print a curl command that sends the signed request",
			}),
			json: JSON_FLAG,
		},
		examples: [
			"sign POST https://example.com/inbox -H content-type:application/json --body-file note.json --key-file key.pem --key-id https://example.com/actor#main-key",
			"sign GET https://example.com/feed --scheme draft-cavage --key-env SIGNING_KEY --key-id key-1 --curl | sh",
		],
	}),
	verify: command({
		description: "Verify the signature on a raw HTTP request; exits 1 naming the check that failed",
		arguments: {
			request: argument(s.string(), {
				default: "-",
				valueName: "request.http",
				description: "A raw HTTP/1.1 request (request line, headers, body), or - for stdin",
			}),
		},
		flags: {
			...KEY_FLAGS,
			jwks: flag.string("jwks", {
				valueName: "url",
				description:
					"Verify against the key set served at this URL, picking the key whose kid is the keyid",
				heading: "Key",
			}),
			maxAge: flag.string("max-age", {
				default: "1 hour",
				valueName: "duration",
				description: "How old the signature may be, such as 5 minutes",
			}),
			now: flag.string("now", {
				valueName: "time",
				description: "Check freshness at this ISO date or Unix time instead of now",
			}),
			label: flag.string("label", {
				valueName: "label",
				description: "The RFC 9421 label to verify (default: the first one)",
			}),
			http: flag.boolean("http", {
				description: "Read an origin-form target as http:// rather than https://",
			}),
			json: JSON_FLAG,
		},
		examples: [
			"verify request.http --key-file public.pem",
			"verify --jwks https://bot.example.com/.well-known/http-message-signatures-directory --json < request.http",
		],
	}),
});
