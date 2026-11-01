/**
 * The `new` handler: one fresh UUIDv7 per requested id, each encoded under the prefix, so ids
 * printed in one run sort in the order they were generated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success, usage } from "@sdxc/cli";
import { generateUUID } from "@sdxc/uuid/v7";

import { TYPEID_COMMANDS } from "./cli-contract.js";
import { InvalidPrefixError } from "./lib/errors.js";

import { TypeID } from "./index.js";

/** Prints `--count` ids, one per line; a prefix that breaks the TypeID rules is a usage error. */
export default createCommand(TYPEID_COMMANDS.new, (ctx) => {
	let { prefix } = ctx.arguments;
	try {
		let lines = Array.from({ length: ctx.flags.count }, () =>
			TypeID.fromUUID(prefix, generateUUID()).toString(),
		);
		ctx.stdout(`${lines.join("\n")}\n`);
		return success();
	} catch (error) {
		if (error instanceof InvalidPrefixError) return usage(error.message);
		throw error;
	}
});
