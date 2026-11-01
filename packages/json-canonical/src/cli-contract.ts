/**
 * The `sdxc-json-canonical` command line as a contract: `canonicalize` writes a document's
 * RFC 8785 bytes and `hash` digests them. Help, usage errors and each handler's typed
 * `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** The JSON document both commands read: a path, or stdin when `-` or absent. */
const INPUT = argument(s.string(), {
	optional: true,
	description: "The JSON file; - or absent reads stdin",
});

/** Every command `sdxc-json-canonical` takes. */
export const JSON_CANONICAL_COMMANDS = commands({
	description: "sdxc-json-canonical — RFC 8785 canonical JSON for hashing and signing",
	canonicalize: command({
		description:
			"Print the canonical form of a JSON document. Text that is not JSON exits 2; JSON outside I-JSON (a lone surrogate, a number past double range) exits 1 naming its JSON Pointer.",
		arguments: { file: INPUT },
		flags: {
			newline: flag.boolean("newline", {
				description: "End the output with a newline, which is not part of the canonical bytes",
			}),
		},
		examples: ["canonicalize payload.json", 'echo \'{"b":2,"a":1}\' | canonicalize --newline'],
	}),
	hash: command({
		description: "Print the digest of a JSON document's canonical UTF-8 bytes.",
		arguments: { file: INPUT },
		flags: {
			alg: flag.string("alg", {
				valueName: "sha-256|sha-384|sha-512",
				default: "sha-256",
				schema: s.enum_(["sha-256", "sha-384", "sha-512"] as const),
				description: "The digest algorithm",
			}),
			base64url: flag.boolean("base64url", {
				description: "Print the digest as unpadded base64url instead of lowercase hex",
			}),
		},
		examples: ["hash payload.json", "cat payload.json | hash --alg sha-512 --base64url"],
	}),
});
