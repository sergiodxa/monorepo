/**
 * The `sdxc-email-address` command line as a contract: `check` an address, or a list of them
 * on stdin, with `--json` and `--skip-mx`. Help, usage errors and the handler's typed
 * `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";

/** An address as typed: any string passes, so the report names the rule a malformed one fails. */
const ADDRESS = {
	"~standard": {
		version: 1 as const,
		vendor: "@sdxc/email-address",
		types: { input: "", output: "" },
		validate(value: unknown) {
			if (typeof value === "string") return { value };
			return { issues: [{ message: `expects an address; got ${JSON.stringify(value)}` }] };
		},
	},
};

/** Every command `sdxc-email-address` takes. */
export const EMAIL_ADDRESS_COMMANDS = commands({
	description: "sdxc-email-address — parse and check email addresses",
	check: command({
		description:
			"Parse and normalize an address, then flag a disposable domain and a domain without a mail server. Pass - or nothing to read one address per line from stdin. Exits 1 when any address is invalid, disposable or cannot receive mail.",
		arguments: {
			address: argument(ADDRESS, {
				default: "-",
				description: "The address to check; - or nothing reads one per line from stdin",
			}),
		},
		flags: {
			skipMx: flag.boolean("skip-mx", {
				description: "Leave out the DNS lookup of the domain's mail servers",
			}),
			json: flag.boolean("json", { description: "Print the report as JSON" }),
		},
		examples: [
			"check jane@example.com",
			"check jane@example.com --json",
			"check < signups.txt --skip-mx",
		],
	}),
});
