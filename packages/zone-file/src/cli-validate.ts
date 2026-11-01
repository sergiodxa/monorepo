/**
 * The `sdxc-zone-file validate` handler: reads a zone file and reports every entry the parser
 * could not use with its line. A rejected entry is the finding the check exists for, so it exits
 * 1; only unreadable or oversized input exits 2.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { ZONE_FILE_COMMANDS } from "./cli-contract.js";
import { describeRejection, parseInput, readInput } from "./cli-input.js";

/**
 * Prints `file: N records, no problems`, or one `file:line: message (reason)` line per problem
 * on stderr; `--json` prints `{ valid, records, rejected }` on stdout in both cases, `records`
 * being the count read.
 */
export default createCommand(ZONE_FILE_COMMANDS.validate, async (ctx) => {
	let input = await readInput(ctx, ctx.arguments.zone);
	if (isFailure(input)) return input;

	let zone = parseInput(input.data, ctx.flags);
	if (isFailure(zone)) return zone;

	let { records, rejected } = zone.data;
	if (ctx.flags.json) {
		let report = { valid: rejected.length === 0, records: records.length, rejected };
		ctx.stdout(`${JSON.stringify(report, null, 2)}\n`);
		return rejected.length === 0 ? success() : exit(1);
	}

	if (rejected.length === 0) {
		let noun = records.length === 1 ? "record" : "records";
		ctx.stdout(`${input.data.name}: ${records.length} ${noun}, no problems\n`);
		return success();
	}

	for (let rejection of rejected) ctx.stderr(`${describeRejection(input.data.name, rejection)}\n`);
	let noun = rejected.length === 1 ? "problem" : "problems";
	return exit(1, `${rejected.length} ${noun} in ${input.data.name}`);
});
