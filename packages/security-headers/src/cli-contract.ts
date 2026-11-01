/**
 * The `sdxc-security-headers` command line as a contract: `audit` grades the security headers
 * a page sends and `csp parse` reads a Content-Security-Policy into the package's typed model.
 * Help, usage errors and each handler's typed `ctx.arguments` and `ctx.flags` come from here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** Every command `sdxc-security-headers` takes. */
export const SECURITY_HEADERS_COMMANDS = commands({
	description: "sdxc-security-headers — audit and parse security response headers",
	audit: command({
		description:
			"Fetch a page and grade each security header as ok, missing or weak. Exits 1 when any header is missing or weak.",
		arguments: {
			url: argument(s.string(), { description: "The page to fetch, following redirects" }),
		},
		flags: {
			json: flag.boolean("json", {
				description: "Print the report as JSON: { url, status, passed, findings }",
			}),
		},
		examples: ["audit https://sdxc.dev", "audit https://sdxc.dev --json"],
	}),
	csp: commands({
		description: "Content-Security-Policy tools",
		parse: command({
			description:
				"Read a Content-Security-Policy value into its directives. A value outside the CSP grammar exits 2.",
			arguments: {
				policy: argument(s.string(), {
					default: "-",
					description: "The header value; - or absent reads stdin",
				}),
			},
			flags: {
				json: flag.boolean("json", {
					description: "Print the policies as JSON: [{ directives, unknown }]",
				}),
			},
			examples: [
				`csp parse "default-src 'self'; script-src 'self' 'nonce-abc'"`,
				"csp parse --json < policy.txt",
			],
		}),
	}),
});
