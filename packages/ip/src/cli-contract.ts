/**
 * The `sdxc-ip` command line as a contract: `classify` names what an address is for, and
 * `contains` tests whether a range holds an address. Help, usage errors and each handler's
 * typed `ctx.arguments` and `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";

/** A Standard Schema over the text an argument was typed as. */
interface TextSchema {
	"~standard": {
		version: 1;
		vendor: string;
		types: { input: unknown; output: string };
		validate(value: unknown): { value: string } | { issues: [{ message: string }] };
	};
}

/**
 * Accepts any text, so the package needs no schema library; each handler parses the text
 * itself and answers its own exit 2 naming the rejected value.
 */
const TEXT: TextSchema = {
	"~standard": {
		version: 1,
		vendor: "@sdxc/ip",
		types: { input: undefined, output: "" },
		validate(value) {
			if (typeof value === "string") return { value };
			return { issues: [{ message: `expects text; got ${JSON.stringify(value)}` }] };
		},
	},
};

/** The `--json` flag every report-printing command takes. */
function json() {
	return flag.boolean("json", { description: "Print the result as JSON" });
}

/** Every command `sdxc-ip` takes. */
export const IP_COMMANDS = commands({
	description: "sdxc-ip — IPv4 and IPv6 addresses against the IANA special-purpose registries",
	classify: command({
		description:
			"Print an address's version, canonical form and IANA special-purpose classification",
		arguments: {
			address: argument(TEXT, {
				default: "-",
				description: "The address, or - to read it from stdin",
			}),
		},
		flags: { json: json() },
		examples: ["classify 192.168.1.10", "classify ::ffff:10.0.0.1 --json", "classify - < ip.txt"],
	}),
	contains: command({
		description: "Exit 0 when the range holds the address and 1 when it does not",
		arguments: {
			range: argument(TEXT, { description: "The range as network/prefix" }),
			address: argument(TEXT, {
				default: "-",
				description: "The address, or - to read it from stdin",
			}),
		},
		flags: { json: json() },
		examples: ["contains 10.0.0.0/8 10.1.2.3", "contains 2001:db8::/32 2001:db8::1 --json"],
	}),
});
