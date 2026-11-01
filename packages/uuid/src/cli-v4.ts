/**
 * The `sdxc-uuid v4` handler: prints random version 4 UUIDs from the package's own generator,
 * one per line, for ids that must not reveal when they were created.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";

import { UUID_COMMANDS } from "./cli-contract.js";
import { generateUUID } from "./v4.js";

/** Prints `--count` values, each on its own line. */
export default createCommand(UUID_COMMANDS.v4, (ctx) => {
	let ids = Array.from({ length: ctx.flags.count }, () => generateUUID());
	ctx.stdout(`${ids.join("\n")}\n`);
	return success();
});
