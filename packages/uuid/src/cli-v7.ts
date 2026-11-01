/**
 * The `sdxc-uuid v7` handler: prints time-ordered version 7 UUIDs, one per line, in the order
 * they sort, so a batch can seed a table or fixture already in index order.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, success } from "@sdxc/cli";

import { UUID_COMMANDS } from "./cli-contract.js";
import { generateUUID } from "./v7.js";

/** Prints `--count` values, each on its own line and each sorting after the line above. */
export default createCommand(UUID_COMMANDS.v7, (ctx) => {
	let ids = Array.from({ length: ctx.flags.count }, () => generateUUID());
	ctx.stdout(`${ids.join("\n")}\n`);
	return success();
});
