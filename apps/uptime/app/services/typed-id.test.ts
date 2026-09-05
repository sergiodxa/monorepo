/**
 * Unit tests for the API's TypeID boundary. The round trip matters because the
 * database stores canonical UUIDs while every `/api/v1/*` identifier is a prefixed
 * string, and the rejection cases matter because they are what makes an id from one
 * resource unusable against another.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { generateUUID } from "@sdxc/uuid";
import * as s from "remix/data-schema";
import { describe, expect, test } from "vitest";

import {
	decodeIdOrUUID,
	decodeMonitorId,
	encodeId,
	encodeMonitorId,
	typedId,
} from "~/app/services/typed-id";

describe("encodeId", () => {
	test("produces a prefixed TypeID for a stored UUID", () => {
		expect(encodeId("mon", generateUUID())).toMatch(/^mon_[0-9a-hjkmnp-tv-z]{26}$/);
	});

	test("gives one UUID the same TypeID every time", () => {
		let id = generateUUID();
		expect(encodeId("mon", id)).toBe(encodeId("mon", id));
	});

	test("gives one UUID a different TypeID under each prefix", () => {
		let id = generateUUID();
		expect(encodeId("mon", id)).not.toBe(encodeId("alt", id));
	});

	test("rejects a value that is not a canonical UUID", () => {
		expect(() => encodeId("mon", "monitor-1")).toThrow();
	});
});

describe("typedId", () => {
	let Params = s.object({ monitorId: typedId("mon") });

	test("decodes a TypeID back to the UUID the row is keyed by", () => {
		let id = generateUUID();
		expect(s.parse(Params, { monitorId: encodeId("mon", id) }).monitorId).toBe(id);
	});

	test("rejects the raw UUID behind the TypeID", () => {
		expect(() => s.parse(Params, { monitorId: generateUUID() })).toThrow(s.ValidationError);
	});

	test("rejects an id belonging to another resource", () => {
		expect(() => s.parse(Params, { monitorId: encodeId("alt", generateUUID()) })).toThrow(
			s.ValidationError,
		);
	});

	test("rejects a value that is not a TypeID at all", () => {
		expect(() => s.parse(Params, { monitorId: "garbage" })).toThrow(s.ValidationError);
	});
});

describe("decodeIdOrUUID", () => {
	test("decodes a TypeID to the UUID the row is keyed by", () => {
		let id = generateUUID();
		expect(decodeIdOrUUID("cron", encodeId("cron", id))).toBe(id);
	});

	test("passes through the raw UUID an older caller saved", () => {
		let id = generateUUID();
		expect(decodeIdOrUUID("cron", id)).toBe(id);
	});

	test("reports null for an id carrying another resource's prefix", () => {
		expect(decodeIdOrUUID("cron", encodeId("mon", generateUUID()))).toBeNull();
	});

	test("reports null for a value in neither form", () => {
		expect(decodeIdOrUUID("cron", "not-an-id")).toBeNull();
	});
});

describe("encodeMonitorId", () => {
	test("gives each monitor type the prefix naming its own table", () => {
		let id = generateUUID();
		expect(encodeMonitorId("dns", id)).toBe(encodeId("dns", id));
		expect(encodeMonitorId("tcp", id)).toBe(encodeId("tcpm", id));
		expect(encodeMonitorId("flow", id)).toBe(encodeId("flow", id));
		expect(encodeMonitorId("cron", id)).toBe(encodeId("cron", id));
	});

	test("reports an SSL event through its HTTP monitor's prefix", () => {
		let id = generateUUID();
		expect(encodeMonitorId("ssl", id)).toBe(encodeId("mon", id));
	});

	test("reads a row stored without a type as an HTTP monitor", () => {
		let id = generateUUID();
		expect(encodeMonitorId(null, id)).toBe(encodeId("mon", id));
	});
});

describe("decodeMonitorId", () => {
	test("round trips an id under the type it was encoded for", () => {
		let id = generateUUID();
		expect(decodeMonitorId("dns", encodeMonitorId("dns", id))).toBe(id);
	});

	test("reports null for an id naming a different monitor type", () => {
		expect(decodeMonitorId("dns", encodeId("mon", generateUUID()))).toBeNull();
	});

	test("reports null for a raw UUID", () => {
		expect(decodeMonitorId("http", generateUUID())).toBeNull();
	});
});
