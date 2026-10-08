/**
 * Pins the public surface: the functions a namespace import reaches, and the types it
 * reads as `ZoneFile.Record` rather than through a nested namespace.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { unwrap } from "@sdxc/result";
import { describe, expect, expectTypeOf, test } from "vitest";

import type { ZoneFile as ZoneFileTypes } from "./index.js";

import * as ZoneFile from "./index.js";

describe("@sdxc/zone-file", () => {
	test("exports the functions and errors", () => {
		expect(Object.keys(ZoneFile).sort()).toEqual([
			"RecordDataError",
			"ZoneFileError",
			"canonicalType",
			"formatRecordData",
			"parse",
			"parseRecordData",
			"stringify",
			"typeName",
		]);
	});

	test("reads its types through a namespace import and through the `ZoneFile` type export", () => {
		let zone = unwrap(ZoneFile.parse("www 300 IN A 192.0.2.1", { origin: "example.com" }));
		expectTypeOf(zone).toEqualTypeOf<ZoneFile.Zone>();
		expectTypeOf(zone.records).toEqualTypeOf<ZoneFile.Record[]>();
		expectTypeOf<ZoneFile.Record>().toEqualTypeOf<ZoneFileTypes.Record>();
		expect(zone.records).toHaveLength(1);
	});
});
