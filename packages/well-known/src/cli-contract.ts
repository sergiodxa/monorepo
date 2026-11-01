/**
 * The `sdxc-well-known` command line as a contract: `security-txt check` for a site's or a
 * file's security.txt, and `fetch` for any JSON document the package reads. Help, usage
 * errors and each handler's typed `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "@remix-run/data-schema";
import { argument, command, commands, flag } from "@sdxc/cli";

/** The documents `fetch` reads, by the registered name they are served under. */
export const DOCUMENTS = [
	"webfinger",
	"nodeinfo",
	"oauth-authorization-server",
	"openid-configuration",
	"oauth-protected-resource",
	"jwks.json",
	"passkey-endpoints",
	"api-catalog",
	"http-message-signatures-directory",
] as const;

/** A document name `fetch` accepts. */
export type DocumentName = (typeof DOCUMENTS)[number];

/** Every command `sdxc-well-known` takes. */
export const WELL_KNOWN_COMMANDS = commands({
	description: "sdxc-well-known — read and check /.well-known/ documents",
	"security-txt": commands({
		description: "security.txt (RFC 9116)",
		check: command({
			description:
				"Check a security.txt: required fields, field syntax and expiry. An http(s) origin fetches its /.well-known/security.txt; anything else is a file, - or nothing reads stdin. Exits 1 and lists every problem.",
			arguments: {
				target: argument(s.string(), {
					default: "-",
					description: "An origin (https://example.com), a file, or - for stdin",
				}),
			},
			flags: {
				json: flag.boolean("json", { description: "Print the report as JSON" }),
			},
			examples: [
				"security-txt check https://example.com",
				"security-txt check public/.well-known/security.txt --json",
			],
		}),
	}),
	fetch: command({
		description:
			"Fetch one well-known document from an origin, validate it and print it. OAuth and OpenID Connect metadata must name the identifier as their issuer, and protected resource metadata as its resource. Exits 1 and lists every problem on stderr.",
		arguments: {
			identifier: argument(s.string(), {
				description: "The origin, issuer or resource URL (https://example.com)",
			}),
			document: argument(s.enum_(DOCUMENTS), {
				description: `The document to read: ${DOCUMENTS.join(", ")}`,
			}),
		},
		flags: {
			resource: flag.string("resource", {
				description: "The WebFinger resource to look up (acct:user@example.com)",
			}),
			rel: flag.string("rel", { description: "A WebFinger link relation to ask for" }).multiple(),
			json: flag.boolean("json", {
				description: "Print { document, url, valid, issues, data } with the parsed document",
			}),
		},
		examples: [
			"fetch https://auth.example.com openid-configuration",
			"fetch https://mastodon.social webfinger --resource acct:Gargron@mastodon.social",
			"fetch https://example.com jwks.json --json",
		],
	}),
});
