/**
 * The `sdxc-zone-file` command line as a contract: `validate` reports every entry a zone file
 * could not use, `parse` prints its records, and `format` writes records back as a normalized
 * zone file. Help, usage errors and each handler's typed flags come from this one declaration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Schema } from "remix/data-schema";

import { argument, command, commands, flag } from "@sdxc/cli";
import * as s from "remix/data-schema";

/** A TTL in seconds, written as digits only, so `1h` and `-5` are usage errors. */
function seconds(): Schema<unknown, number> {
	return s.createSchema(function validate(value, context) {
		if (typeof value === "string" && /^\d+$/.test(value)) return { value: Number(value) };
		return s.fail(`expects a TTL in seconds; got ${JSON.stringify(value)}`, context.path);
	});
}

/** The input argument every command takes: a path, or stdin when it is `-` or absent. */
function input(description: string) {
	return argument(s.string(), { default: "-", description });
}

/** The `--origin` flag: the name `@` and relative names resolve against until a `$ORIGIN`. */
function origin() {
	return flag.string("origin", {
		valueName: "name",
		default: ".",
		description: "The initial $ORIGIN; relative names resolve against it",
	});
}

/** The `--ttl` flag: the TTL a record gets when neither it, a `$TTL` nor an earlier record states one. */
function ttl() {
	return flag.string("ttl", {
		valueName: "seconds",
		schema: seconds(),
		description: "The TTL a record without one gets",
	});
}

/** Every command `sdxc-zone-file` takes. */
export const ZONE_FILE_COMMANDS = commands({
	description: "sdxc-zone-file — read, check and write RFC 1035 DNS zone files",
	validate: command({
		description:
			"Read a zone file and report every entry it could not use, with its line. Exits 1 when there is any.",
		arguments: { zone: input("The zone file; - or absent reads stdin") },
		flags: {
			origin: origin(),
			ttl: ttl(),
			json: flag.boolean("json", {
				description: "Print the result as JSON: { valid, records, rejected }",
			}),
		},
		examples: ["validate example.com.zone --origin example.com", "validate db.zone --json"],
	}),
	parse: command({
		description:
			"Print the records a zone file declares, one per line. Exits 1 when an entry could not be read.",
		arguments: { zone: input("The zone file; - or absent reads stdin") },
		flags: {
			origin: origin(),
			ttl: ttl(),
			json: flag.boolean("json", {
				description: "Print the zone as JSON: { origin, records, rejected }",
			}),
		},
		examples: ["parse example.com.zone --origin example.com --json"],
	}),
	format: command({
		description:
			"Write records as a normalized zone file. Reads JSON ({ origin?, ttl?, records } or an array of records) or a zone file.",
		arguments: { input: input("JSON records or a zone file; - or absent reads stdin") },
		flags: {
			origin: origin(),
			ttl: ttl(),
			relative: flag.boolean("relative", {
				description: "Write names under the origin relative to it, the apex as @",
			}),
		},
		examples: [
			"format records.json --relative",
			"format example.com.zone --origin example.com --ttl 3600",
		],
	}),
});
