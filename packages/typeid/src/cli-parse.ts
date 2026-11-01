/**
 * The `parse` handler: reads a TypeID with `TypeID.fromString` and prints its prefix, suffix,
 * UUID and, for a UUIDv7 suffix, the creation time. An invalid TypeID exits 1 with the reason.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createCommand, exit, success } from "@sdxc/cli";

import { TYPEID_COMMANDS } from "./cli-contract.js";

import { TypeID } from "./index.js";

/** What `parse --json` prints for a TypeID it read. */
interface Parsed {
	valid: true;
	prefix: string;
	suffix: string;
	uuid: string;
	/** ISO 8601 creation time of a UUIDv7 suffix; `null` for any other UUID version. */
	timestamp: string | null;
}

/**
 * Prints the parts as aligned `name: value` lines, or as JSON with `--json`. An invalid
 * TypeID prints `{ "valid": false, "error": … }` under `--json` and exits 1 either way.
 */
export default createCommand(TYPEID_COMMANDS.parse, (ctx) => {
	let parsed: Parsed;
	try {
		let value = TypeID.fromString(ctx.arguments.typeid);
		parsed = {
			valid: true,
			prefix: value.prefix,
			suffix: value.suffix,
			uuid: value.toUUID(),
			timestamp: value.toDate()?.toISOString() ?? null,
		};
	} catch (error) {
		let message = error instanceof Error ? error.message : String(error);
		if (!ctx.flags.json) return exit(1, message);
		ctx.stdout(`${JSON.stringify({ valid: false, error: message }, null, 2)}\n`);
		return exit(1);
	}
	if (ctx.flags.json) {
		ctx.stdout(`${JSON.stringify(parsed, null, 2)}\n`);
		return success();
	}
	ctx.stdout(
		[
			`prefix:    ${parsed.prefix}`,
			`suffix:    ${parsed.suffix}`,
			`uuid:      ${parsed.uuid}`,
			`timestamp: ${parsed.timestamp ?? "none (not a UUIDv7)"}`,
			"",
		].join("\n"),
	);
	return success();
});
