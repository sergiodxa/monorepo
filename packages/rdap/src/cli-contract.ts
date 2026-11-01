/**
 * The `sdxc-rdap` command line as a contract: `lookup` for a domain's registration and
 * `expires` for a cron or CI check on its expiry. Help, usage errors and each handler's typed
 * `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "remix/data-schema";

import { argument, command, commands, flag } from "@sdxc/cli";
import { parse } from "@sdxc/duration";
import { isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";

/**
 * A positive duration as `@sdxc/duration` reads it (`30 days`, `2 weeks`, `10s`), in
 * milliseconds, so a typo is a usage error before any registry is asked.
 */
const DURATION: Schema<unknown, number> = s.createSchema(function validate(value, context) {
	let parsed = typeof value === "string" ? parse(value) : null;
	if (parsed === null || isFailure(parsed) || parsed.data <= 0) {
		return s.fail(
			`expects a duration such as "30 days" or "2 weeks"; got ${JSON.stringify(value)}`,
			context.path,
		);
	}
	return { value: parsed.data };
});

/** The registered name both commands take. */
function domain() {
	return argument(s.string(), {
		description: "The registered domain, such as example.com or example.co.uk",
	});
}

/** The flags every command shares: how to reach the registry and how to print. */
function shared() {
	return {
		userAgent: flag.string("user-agent", {
			valueName: "text",
			default: "sdxc-rdap (+https://www.npmjs.com/package/@sdxc/rdap)",
			description: "Sent on every request, so a registry that rate-limits can identify you",
			heading: "Request",
		}),
		timeout: flag.string("timeout", {
			valueName: "duration",
			default: 10_000,
			schema: DURATION,
			description: "The deadline for each request chain, redirects and body included",
			heading: "Request",
		}),
		json: flag.boolean("json", { description: "Print the result as JSON" }),
	};
}

/** Every command `sdxc-rdap` takes. */
export const RDAP_COMMANDS = commands({
	description: "sdxc-rdap — domain registration data from the registry, over RDAP",
	lookup: command({
		description: "Print a domain's expiry, status, registrar, contacts and nameservers",
		arguments: { domain: domain() },
		flags: {
			related: flag.boolean("related", {
				description: "Also ask the registrar's server for the fields a thin registry leaves out",
			}),
			...shared(),
		},
		examples: ["lookup example.com", "lookup example.com --related --json"],
	}),
	expires: command({
		description:
			"Exit 1 when the domain expires inside the window, or its registry publishes no expiry",
		arguments: { domain: domain() },
		flags: {
			within: flag.string("within", {
				required: true,
				valueName: "duration",
				schema: DURATION,
				description: 'How far ahead to look, such as "30 days" or 2w',
			}),
			...shared(),
		},
		examples: ["expires example.com --within '30 days'", "expires example.com --within 2w --json"],
	}),
});
