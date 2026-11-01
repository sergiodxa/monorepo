/**
 * The `sdxc-json-patch` command line as a contract: `apply` a patch to a document, `diff` two
 * documents into a patch, and `validate` a patch. Help, usage errors and each handler's typed
 * `ctx.arguments` and `ctx.flags` all come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { argument, command, commands, flag } from "@sdxc/cli";

/**
 * A Standard Schema accepting a path exactly as typed, so the package needs no schema library
 * for its positional arguments.
 */
const PATH = {
	"~standard": {
		version: 1 as const,
		vendor: "@sdxc/json-patch",
		types: { input: "", output: "" },
		validate(value: unknown) {
			if (typeof value === "string") return { value };
			return { issues: [{ message: `expects a path; got ${JSON.stringify(value)}` }] };
		},
	},
};

/** The `--compact` flag of every command that prints JSON for a person to read by default. */
function compact() {
	return flag.boolean("compact", { description: "Print the JSON on one line" });
}

/** Every command `sdxc-json-patch` takes. */
export const JSON_PATCH_COMMANDS = commands({
	description: "sdxc-json-patch — apply, diff and validate RFC 6902 JSON Patch documents",
	apply: command({
		description:
			"Apply a patch to a JSON document and print the result; exits 1 when an operation's path or test fails",
		arguments: {
			patch: argument(PATH, {
				description: "The patch file, or - for stdin",
			}),
			document: argument(PATH, {
				optional: true,
				description: "The document to patch; stdin when - or left out",
			}),
		},
		flags: { compact: compact() },
		examples: ["apply patch.json article.json", "apply patch.json < article.json > patched.json"],
	}),
	diff: command({
		description: "Print the patch that turns one JSON document into another",
		arguments: {
			before: argument(PATH, { description: "The original document, or - for stdin" }),
			after: argument(PATH, { description: "The edited document, or - for stdin" }),
		},
		flags: { compact: compact() },
		examples: ["diff before.json after.json", "diff before.json after.json > patch.json"],
	}),
	validate: command({
		description: "Check that a file is a JSON Patch document; exits 1 when it is not",
		arguments: {
			patch: argument(PATH, {
				optional: true,
				description: "The patch file; stdin when - or left out",
			}),
		},
		flags: { json: flag.boolean("json", { description: "Print the result as JSON" }) },
		examples: ["validate patch.json", "validate patch.json --json"],
	}),
});
