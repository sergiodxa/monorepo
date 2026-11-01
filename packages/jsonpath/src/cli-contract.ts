/**
 * The `sdxc-jsonpath` command line as a contract: `query` runs an RFC 9535 expression over a
 * JSON document. Help, usage errors and the handler's typed `ctx.arguments` and `ctx.flags`
 * all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** Every command `sdxc-jsonpath` takes. */
export const JSONPATH_COMMANDS = commands({
	description: "sdxc-jsonpath — RFC 9535 JSONPath queries over JSON documents",
	query: command({
		description:
			"Print the values an expression selects as a JSON array. An invalid expression exits 2 pointing at the offset where it fails.",
		arguments: {
			expression: argument(s.string(), {
				description: "The JSONPath expression, starting with $",
			}),
			file: argument(s.string(), {
				default: "-",
				description: "The JSON document; - or absent reads stdin",
			}),
		},
		flags: {
			paths: flag.boolean("paths", {
				description: "Print the normalized paths of the matches instead of their values",
			}),
			first: flag.boolean("first", {
				description: "Print only the first match as a single JSON value, or nothing",
			}),
			failEmpty: flag.boolean("fail-empty", {
				description: "Exit 1 when the expression selects nothing",
			}),
		},
		examples: [
			"query '$.store.book[?@.price < 10].title' store.json",
			"query '$..id' store.json --paths",
			"cat package.json | query '$.name' --first",
		],
	}),
});
