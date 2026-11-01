/**
 * The `sdxc-zone-file format` handler: writes records as a zone file with one spelling per
 * record — canonical names, addresses and quoting — so two exports of one zone diff only where
 * their records differ. It reads JSON records, `parse --json` output included, or a zone file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ExitError } from "@sdxc/cli";
import type { Result } from "@sdxc/result";

import { createCommand, exit, success } from "@sdxc/cli";
import { failure, isFailure } from "@sdxc/result";
import * as s from "remix/data-schema";

import type * as ZoneFile from "./types.js";

import { ZONE_FILE_COMMANDS } from "./cli-contract.js";
import { describeRejection, parseInput, readInput } from "./cli-input.js";
import { parse } from "./parse.js";
import { stringify } from "./stringify.js";

/** What every record in JSON input needs; its type's fields pass through and are checked by writing it. */
const RECORD = s.object(
	{
		name: s.string(),
		type: s.string(),
		ttl: s.optional(s.nullable(s.number())),
		class: s.optional(s.string()),
		comment: s.optional(s.nullable(s.string())),
		origin: s.optional(s.string()),
	},
	{ unknownKeys: "passthrough" },
);

/** JSON input: a bare array of records, or a zone with an optional origin and TTL. */
const JSON_INPUT = s.union([
	s.array(RECORD),
	s.object({
		origin: s.optional(s.string()),
		ttl: s.optional(s.nullable(s.number())),
		records: s.array(RECORD),
	}),
]);

/**
 * Writes the zone to stdout. JSON that is not records exits 2; a zone file with entries it could
 * not read, or a record whose fields do not fit its type, prints each problem on stderr, writes
 * nothing and exits 1, so a normalized file never silently drops a record.
 */
export default createCommand(ZONE_FILE_COMMANDS.format, async (ctx) => {
	let input = await readInput(ctx, ctx.arguments.input);
	if (isFailure(input)) return input;

	let { name, text } = input.data;
	let flagOrigin = ctx.flags.origin === "." ? undefined : ctx.flags.origin;
	let trimmed = text.trimStart();

	if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
		let zone = parseInput(input.data, ctx.flags);
		if (isFailure(zone)) return zone;
		if (zone.data.rejected.length > 0) {
			for (let rejection of zone.data.rejected) {
				ctx.stderr(`${describeRejection(name, rejection)}\n`);
			}
			return exit(1, `${name} has entries that could not be read; nothing was written`);
		}
		let origin = zone.data.origin === "." ? undefined : zone.data.origin;
		let zoneInput = { origin, ttl: ctx.flags.ttl, records: zone.data.records };
		ctx.stdout(stringify(zoneInput, { relative: ctx.flags.relative }));
		return success();
	}

	let zone = readJson(name, trimmed);
	if (isFailure(zone)) return zone;

	let problems = zone.data.records.flatMap((record, index) => {
		let checked = checkRecord(record);
		return isFailure(checked)
			? [`${name}: records[${index}] (${record.type}): ${checked.error.message}`]
			: [];
	});
	if (problems.length > 0) {
		for (let problem of problems) ctx.stderr(`${problem}\n`);
		return exit(1, `${name} has records that could not be written; nothing was written`);
	}

	let zoneInput: ZoneFile.ZoneInput = {
		origin: zone.data.origin ?? flagOrigin,
		ttl: ctx.flags.ttl ?? zone.data.ttl,
		records: zone.data.records as unknown as ZoneFile.RecordInput[],
	};
	ctx.stdout(stringify(zoneInput, { relative: ctx.flags.relative }));
	return success();
});

/** JSON input after its envelope is checked; each record's type-specific fields are still unchecked. */
interface JsonZone {
	origin?: string;
	ttl?: number | null;
	records: s.InferOutput<typeof RECORD>[];
}

/**
 * Reads JSON input into a zone, accepting a bare array of records.
 *
 * @param name - What the input is called, for the error
 * @param text - The JSON text
 * @returns The zone, or an exit 2 naming every field that does not fit
 */
function readJson(name: string, text: string): Result<JsonZone, ExitError> {
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return exit(2, `${name} is not valid JSON: ${reason}`);
	}

	let parsed = s.parseSafe(JSON_INPUT, value);
	if (!parsed.success) {
		let issues = parsed.issues.map((issue) => `  ${issuePath(issue.path)}: ${issue.message}`);
		return exit(2, `${name} is not a list of records:\n${issues.join("\n")}`);
	}
	return success(Array.isArray(parsed.value) ? { records: parsed.value } : parsed.value);
}

/** A Standard Schema issue path as `records[0].name`, or `(root)` for the value itself. */
function issuePath(path: ReadonlyArray<PropertyKey | { key: PropertyKey }> | undefined): string {
	if (path === undefined || path.length === 0) return "(root)";
	return path
		.map((segment) => (typeof segment === "object" ? segment.key : segment))
		.map((key, index) =>
			typeof key === "number" ? `[${key}]` : `${index === 0 ? "" : "."}${String(key)}`,
		)
		.join("");
}

/**
 * Writes one record alone and reads it back, so a field missing or invalid for its type is
 * reported against the record rather than printed into the zone.
 *
 * @param record - A record whose envelope already passed `RECORD`
 * @returns Nothing, or the reason the record cannot be written
 */
function checkRecord(record: s.InferOutput<typeof RECORD>): Result<void, Error> {
	let line: string;
	try {
		line = stringify({ records: [record as unknown as ZoneFile.RecordInput] });
	} catch (error) {
		let reason = error instanceof Error ? error.message : String(error);
		return failure(new Error(`missing fields for its type (${reason})`));
	}

	let read = parse(line, { origin: "." });
	if (isFailure(read)) return read;
	let [rejection] = read.data.rejected;
	if (rejection !== undefined) return failure(new Error(rejection.message));
	return success();
}
