/**
 * The `sdxc-zone-file parse` handler: prints the records a zone file declares, one
 * `name ttl class type data` line each with the data in canonical presentation format, or the
 * whole zone as JSON for a script to read.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";
import { isFailure } from "@sdxc/result";

import { ZONE_FILE_COMMANDS } from "./cli-contract.js";
import { describeRejection, parseInput, readInput } from "./cli-input.js";
import { formatRecordData } from "./format-record-data.js";

/**
 * Prints every record it read, tab-separated, with `-` for a record without a TTL; `--json`
 * prints `{ origin, records, rejected }`. Entries it could not read go to stderr and exit 1,
 * after the records that did parse are printed.
 */
export default createCommand(ZONE_FILE_COMMANDS.parse, async (ctx) => {
	let input = await readInput(ctx, ctx.arguments.zone);
	if (isFailure(input)) return input;

	let zone = parseInput(input.data, ctx.flags);
	if (isFailure(zone)) return zone;

	let { records, rejected } = zone.data;
	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify(zone.data, null, 2)}\n`);
	} else {
		for (let record of records) {
			let fields = [record.name, record.ttl ?? "-", record.class, record.type];
			ctx.stdout(`${[...fields, formatRecordData(record)].join("\t")}\n`);
		}
		for (let rejection of rejected) {
			ctx.stderr(`${describeRejection(input.data.name, rejection)}\n`);
		}
	}

	if (rejected.length === 0) return success();
	let noun = rejected.length === 1 ? "entry" : "entries";
	return exit(1, ctx.flags.json ? undefined : `${rejected.length} ${noun} could not be read`);
});
