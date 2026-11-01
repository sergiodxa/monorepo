/**
 * The `sdxc-webmention` command line as a contract: `discover` a target's endpoint, `send` a
 * mention to it, and `verify` a source links to a target as a receiver checks it. Help, usage
 * errors and each handler's typed input come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** The `--user-agent` flag every command fetches under, so a publisher can tell who asked. */
function userAgent() {
	return flag.string("user-agent", {
		valueName: "agent",
		default: "sdxc-webmention (+https://sdxc.dev)",
		description: "The User-Agent every request is sent with",
	});
}

/** The `--json` flag, printing the report as data for scripts and agents. */
function json() {
	return flag.boolean("json", { description: "Print the report as JSON" });
}

/** Every command `sdxc-webmention` takes. */
export const WEBMENTION_COMMANDS = commands({
	description: "sdxc-webmention — discover, send and verify Webmentions",
	discover: command({
		description: "Print the target's Webmention endpoint; exits 1 when it advertises none.",
		arguments: { target: argument(s.string(), { description: "The page being mentioned" }) },
		flags: { userAgent: userAgent(), json: json() },
		examples: ["discover https://example.com/post"],
	}),
	send: command({
		description:
			"Discover the target's endpoint and send the mention; exits 1 when there is no endpoint or it refuses.",
		arguments: {
			source: argument(s.string(), { description: "The page doing the mentioning" }),
			target: argument(s.string(), { description: "The page being mentioned" }),
		},
		flags: { userAgent: userAgent(), json: json() },
		examples: ["send https://example.org/reply https://example.com/post"],
	}),
	verify: command({
		description:
			"Check the source links to the target, as a receiver would; exits 1 when it does not.",
		arguments: {
			source: argument(s.string(), { description: "The page doing the mentioning" }),
			target: argument(s.string(), { description: "The page being mentioned" }),
		},
		flags: { userAgent: userAgent(), json: json() },
		examples: ["verify https://example.org/reply https://example.com/post --json"],
	}),
});
