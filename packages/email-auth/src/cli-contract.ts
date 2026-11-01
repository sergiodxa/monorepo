/**
 * The `sdxc-email-auth` command line as a contract: `check <domain>` with its DKIM and BIMI
 * selectors, the policies to skip and `--json`. Help, usage errors and the handler's typed
 * `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "remix/data-schema";

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

import { EMAIL_AUTH_POLICIES } from "./check.js";

/** Dot-separated DNS labels of letters, digits, hyphens and underscores, with an optional root dot. */
const DOMAIN_PATTERN =
	/^(?=.{1,254}$)(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)*[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.?$/i;

/**
 * A DNS name as typed, so a URL or an email address is a usage error naming what was wrong
 * rather than a lookup of a name that cannot exist.
 *
 * @param what - What the name is, for the error line
 */
function dnsName(what: string): Schema<unknown, string> {
	return s.createSchema(function validate(value, context) {
		if (typeof value === "string" && DOMAIN_PATTERN.test(value)) return { value };
		return s.fail(`expects ${what}; got ${JSON.stringify(value)}`, context.path);
	});
}

/** Every command `sdxc-email-auth` takes. */
export const EMAIL_AUTH_COMMANDS = commands({
	description: "sdxc-email-auth — check a domain's email-authentication DNS policies",
	check: command({
		description:
			"Check DMARC, SPF, MTA-STS, TLS-RPT, BIMI and DKIM for each --selector. Exits 1 when any checked policy is missing, invalid or could not be read; warnings exit 0.",
		arguments: {
			domain: argument(dnsName("a domain name"), { description: "The domain mail is sent from" }),
		},
		flags: {
			selector: flag
				.string("selector", {
					short: "s",
					valueName: "name",
					schema: dnsName("a DKIM selector"),
					description: "Check the DKIM key at <name>._domainkey; repeat for each selector",
				})
				.multiple(),
			bimiSelector: flag.string("bimi-selector", {
				valueName: "name",
				default: "default",
				schema: dnsName("a BIMI selector"),
				description: "Read the BIMI record at <name>._bimi",
			}),
			skip: flag
				.string("skip", {
					valueName: "policy",
					schema: s.enum_(EMAIL_AUTH_POLICIES),
					description: `Leave policies out of the check: ${EMAIL_AUTH_POLICIES.join(", ")}`,
				})
				.list(),
			json: flag.boolean("json", { description: "Print the report as JSON" }),
		},
		examples: [
			"check example.com",
			"check example.com --selector google --selector s1",
			"check example.com --skip bimi --json",
		],
	}),
});
