/**
 * Unit tests for `writeFlagDefinition` and `previewFlagDefinition`. The write
 * path is exercised against a small store double that mirrors
 * `WorkerKVFlagStore`'s own `read`/`write` contract — a `Result`-returning
 * write rather than `InMemoryFlagStore`'s void one — so the test proves the
 * function against the same shape production evaluates through.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FlagStoreError, StoredFlagSet } from "@sdxc/flags-engine/store";
import type { Database } from "remix/data-table";

import { success } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import FlagChange from "~/app/models/flag-change";
import { createTestDatabase } from "~/app/test/db";

import type { WritableFlagStore } from "./write-flag-definition";

import { previewFlagDefinition, writeFlagDefinition } from "./write-flag-definition";

/** A store double over one held set, answering `write` the way `WorkerKVFlagStore` does. */
class FakeFlagStore implements WritableFlagStore {
	#set: StoredFlagSet;

	constructor(set: StoredFlagSet = { flags: {} }) {
		this.#set = set;
	}

	read() {
		return success(structuredClone(this.#set));
	}

	write(set: StoredFlagSet) {
		this.#set = set;
		return success(undefined as void);
	}
}

let VALID_DRAFT = { variants: { on: true, off: false }, defaultVariant: "off" };

let db: Database;

beforeEach(async () => {
	db = await createTestDatabase();
});

describe("writeFlagDefinition", () => {
	test("accepts a valid draft, writes it, and records the change", async () => {
		let store = new FakeFlagStore();

		let result = await writeFlagDefinition(store, db, {
			key: "release.example",
			draft: VALID_DRAFT,
			expectedVersion: undefined,
			actor: "sergio@aside.co",
		});

		expect(result.ok).toBe(true);

		let read = store.read();
		expect(read.status === "success" && read.data.flags["release.example"]).toEqual(VALID_DRAFT);

		let changes = await db.findMany(FlagChange.table, { where: { key: "release.example" } });
		expect(changes).toHaveLength(1);
		expect(changes[0]).toMatchObject({
			key: "release.example",
			before: null,
			after: JSON.stringify(VALID_DRAFT),
			actor: "sergio@aside.co",
		});
	});

	test("records the previous definition as before when one already existed", async () => {
		let previous = { variants: { on: true, off: false }, defaultVariant: "on" };
		let store = new FakeFlagStore({ flags: { "release.example": previous }, version: "v1" });

		let result = await writeFlagDefinition(store, db, {
			key: "release.example",
			draft: VALID_DRAFT,
			expectedVersion: "v1",
			actor: "sergio@aside.co",
		});

		expect(result.ok).toBe(true);

		let changes = await db.findMany(FlagChange.table, { where: { key: "release.example" } });
		expect(changes[0]?.before).toBe(JSON.stringify(previous));
	});

	test("refuses a draft the schema would refuse, recording nothing", async () => {
		let store = new FakeFlagStore();

		let result = await writeFlagDefinition(store, db, {
			key: "release.example",
			draft: { variants: {} },
			expectedVersion: undefined,
			actor: "sergio@aside.co",
		});

		expect(result).toMatchObject({ ok: false, reason: "invalid_definition" });

		let read = store.read();
		expect(read.status === "success" && read.data.flags).toEqual({});
		expect(await db.findMany(FlagChange.table, {})).toHaveLength(0);
	});

	test("refuses a write whose expectedVersion has moved, recording nothing", async () => {
		let store = new FakeFlagStore({ flags: {}, version: "v2" });

		let result = await writeFlagDefinition(store, db, {
			key: "release.example",
			draft: VALID_DRAFT,
			expectedVersion: "v1",
			actor: "sergio@aside.co",
		});

		expect(result).toEqual({ ok: false, reason: "stale_version", currentVersion: "v2" });
		expect(await db.findMany(FlagChange.table, {})).toHaveLength(0);
	});

	test("mints a new version on every accepted write", async () => {
		let store = new FakeFlagStore({ flags: {}, version: "v1" });

		let first = await writeFlagDefinition(store, db, {
			key: "release.example",
			draft: VALID_DRAFT,
			expectedVersion: "v1",
			actor: "sergio@aside.co",
		});

		expect(first.ok).toBe(true);
		if (!first.ok) throw new Error("expected a success");
		expect(first.version).not.toBe("v1");
	});
});

describe("previewFlagDefinition", () => {
	let draft: StoredFlagSet = {
		flags: {
			"release.example": {
				variants: { on: true, off: false },
				defaultVariant: "off",
				targeting: [{ when: { op: "segment", name: "internal" }, serve: "on" }],
			},
		},
		segments: { internal: { op: "in", field: "targetingKey", values: ["ten_internal"] } },
	};

	test("serves the variant a rule targets a matching subject with", () => {
		let details = previewFlagDefinition(draft, { targetingKey: "ten_internal" });

		expect(details["release.example"]).toMatchObject({ value: true, reason: "TARGETING_MATCH" });
	});

	test("falls back to the default for a subject the rule does not match", () => {
		let details = previewFlagDefinition(draft, { targetingKey: "ten_other" });

		expect(details["release.example"]).toMatchObject({ value: false, reason: "DEFAULT" });
	});
});
