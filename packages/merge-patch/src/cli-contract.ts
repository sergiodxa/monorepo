/**
 * The `sdxc-merge-patch` command line as a contract: `apply` a merge patch to a JSON document
 * and `diff` two documents into the patch between them. Help, usage errors and each handler's
 * typed arguments and flags come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** Indented output reads well in a terminal; one line suits a pipe or a request body. */
const COMPACT_FLAG = flag.boolean("compact", {
	description: "Print the JSON on one line instead of indented",
});

/** Every command `sdxc-merge-patch` takes. */
export const MERGE_PATCH_COMMANDS = commands({
	description: "sdxc-merge-patch — apply and compute RFC 7396 JSON merge patches",
	apply: command({
		description: "Apply a merge patch to a JSON document and print the merged document",
		arguments: {
			patch: argument(s.string(), {
				valueName: "patch",
				description: "The merge patch to apply; stdin when - and the document is a file",
			}),
			document: argument(s.string(), {
				optional: true,
				valueName: "document",
				description: "The document to patch; stdin when - or left out",
			}),
		},
		flags: { compact: COMPACT_FLAG },
		examples: ["apply patch.json article.json", "apply patch.json < article.json --compact"],
	}),
	diff: command({
		description:
			"Print the merge patch that turns one JSON document into another; exits 1 when the second sets a member to null",
		arguments: {
			before: argument(s.string(), {
				valueName: "before",
				description: "The document the patch applies to; stdin when -",
			}),
			after: argument(s.string(), {
				valueName: "after",
				description: "The document applying the patch must produce; stdin when -",
			}),
		},
		flags: { compact: COMPACT_FLAG },
		examples: ["diff before.json after.json", "diff - edited.json < original.json --compact"],
	}),
});
