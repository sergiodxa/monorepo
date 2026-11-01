/**
 * The `sdxc-user-agent` command line as a contract: `parse` reads one User-Agent string, or one
 * per line of stdin, into its browser, engine, operating system and device. Help, usage errors
 * and the handler's typed `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** Every command `sdxc-user-agent` takes. */
export const USER_AGENT_COMMANDS = commands({
	description: "sdxc-user-agent — read User-Agent strings",
	parse: command({
		description:
			"Print the browser, engine, operating system and device a User-Agent string describes, tab-separated, with - for a part the string does not reveal. With - or no argument, reads one string per line of stdin and prints one line per string.",
		arguments: {
			ua: argument(s.string(), {
				default: "-",
				description: "The User-Agent string; - or nothing reads one per line of stdin",
			}),
		},
		flags: {
			json: flag.boolean("json", { description: "Print one JSON object per string" }),
		},
		examples: [
			'parse "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) …"',
			"parse --json < user-agents.txt",
			"cut -f5 access.log | parse",
		],
	}),
});
