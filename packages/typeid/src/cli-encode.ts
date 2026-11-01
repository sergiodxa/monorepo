/**
 * The `encode` handler: prefixes an existing UUID with `TypeID.fromUUID`, so an id already
 * stored as a UUID can be shown as the TypeID an API serves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success, usage } from "@sdxc/cli";
import { isUUID } from "@sdxc/uuid";

import { TYPEID_COMMANDS } from "./cli-contract.js";
import { InvalidPrefixError } from "./lib/errors.js";

import { TypeID } from "./index.js";

/**
 * Prints the TypeID on one line. A prefix that breaks the TypeID rules or a UUID that is not
 * canonical lowercase is a usage error.
 */
export default createCommand(TYPEID_COMMANDS.encode, (ctx) => {
	let { prefix, uuid } = ctx.arguments;
	if (!isUUID(uuid)) return usage(`Invalid UUID "${uuid}": use the canonical lowercase form`);
	try {
		ctx.stdout(`${TypeID.fromUUID(prefix, uuid).toString()}\n`);
		return success();
	} catch (error) {
		if (error instanceof InvalidPrefixError) return usage(error.message);
		throw error;
	}
});
